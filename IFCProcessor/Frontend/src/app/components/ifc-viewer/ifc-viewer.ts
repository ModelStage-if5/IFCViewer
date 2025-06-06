import { Component, ElementRef, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { IfcService } from '../../services/ifc';
import * as WebIFC from 'web-ifc';

@Component({
  selector: 'app-ifc-viewer',
  imports: [CommonModule],
  templateUrl: './ifc-viewer.html',
  styleUrl: './ifc-viewer.scss'
})
export class IfcViewerComponent implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: true }) fileInputRef!: ElementRef<HTMLInputElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls: any;
  private ifcApi: any;
  private animationId: number = 0;

  isDragOver = false;
  isLoading = false;
  loadingMessage = '';

  constructor(private ifcService: IfcService) {}

  async ngOnInit() {
    await this.initThreeJS();
    await this.initWebIFC();
    this.setupDragAndDrop();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private async initThreeJS() {
    const canvas = this.canvasRef.nativeElement;
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(10, 10, 10);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Controls (basic orbit controls implementation)
    this.setupControls();

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    // Start render loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private async initWebIFC() {
    try {
      this.ifcApi = new WebIFC.IfcAPI();
      await this.ifcApi.Init();
      console.log('Web-IFC initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Web-IFC:', error);
    }
  }

  private setupControls() {
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('mousedown', (event) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    canvas.addEventListener('mousemove', (event) => {
      if (!isMouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      // Rotate camera around the scene
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(this.camera.position);
      spherical.theta -= deltaX * 0.01;
      spherical.phi += deltaY * 0.01;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

      this.camera.position.setFromSpherical(spherical);
      this.camera.lookAt(0, 0, 0);

      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    canvas.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    canvas.addEventListener('wheel', (event) => {
      const scale = event.deltaY > 0 ? 1.1 : 0.9;
      this.camera.position.multiplyScalar(scale);
    });
  }

  private setupDragAndDrop() {
    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.isDragOver = true;
    });

    canvas.addEventListener('dragleave', () => {
      this.isDragOver = false;
    });

    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      this.isDragOver = false;
      
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFileSelect(file);
    }
  }

  private async handleFileSelect(file: File) {
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      alert('Please select an IFC file');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Processing IFC file...';

    try {
      // Upload file to server
      this.loadingMessage = 'Uploading file to server...';
      const uploadResponse = await this.ifcService.uploadFile(file).toPromise();
      console.log('File uploaded:', uploadResponse);

      // Process file with Web-IFC
      this.loadingMessage = 'Parsing IFC data...';
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const modelID = this.ifcApi.OpenModel(uint8Array);
      
      this.loadingMessage = 'Generating 3D geometry...';
      await this.loadIFCGeometry(modelID);
      
      this.ifcApi.CloseModel(modelID);
      
    } catch (error) {
      console.error('Error processing IFC file:', error);
      alert('Error processing IFC file. Please check the console for details.');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  private async loadIFCGeometry(modelID: number) {
    // Clear existing geometry
    const objectsToRemove = this.scene.children.filter(child => 
      child.userData['isIFCGeometry']
    );
    objectsToRemove.forEach(obj => this.scene.remove(obj));

    // Get all IFC items
    const allItems = this.ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPRODUCT);
    
    for (let i = 0; i < allItems.size(); i++) {
      try {
        const itemID = allItems.get(i);
        const geometry = this.ifcApi.GetGeometry(modelID, itemID);
        
        if (geometry.GetVertexDataSize() > 0) {
          const mesh = this.createMeshFromGeometry(geometry);
          if (mesh) {
            mesh.userData['isIFCGeometry'] = true;
            this.scene.add(mesh);
          }
        }
      } catch (error) {
        // Skip items that can't be processed
        console.warn('Could not process item:', error);
      }
    }

    // Adjust camera to fit the model
    this.fitCameraToModel();
  }

  private createMeshFromGeometry(ifcGeometry: any): THREE.Mesh | null {
    try {
      const vertexData = this.ifcApi.GetVertexArray(
        ifcGeometry.GetVertexData(),
        ifcGeometry.GetVertexDataSize()
      );
      
      const indexData = this.ifcApi.GetIndexArray(
        ifcGeometry.GetIndexData(),
        ifcGeometry.GetIndexDataSize()
      );

      const geometry = new THREE.BufferGeometry();
      
      // Set vertices (every 3 values represent x, y, z)
      const vertices = new Float32Array(vertexData);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      // Set indices
      const indices = new Uint32Array(indexData);
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      
      // Compute normals for proper lighting
      geometry.computeVertexNormals();

      // Create material
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(Math.random(), Math.random(), Math.random()),
        side: THREE.DoubleSide
      });

      return new THREE.Mesh(geometry, material);
    } catch (error) {
      console.error('Error creating mesh:', error);
      return null;
    }
  }

  private fitCameraToModel() {
    const box = new THREE.Box3();
    
    this.scene.children.forEach(child => {
      if (child.userData['isIFCGeometry']) {
        box.expandByObject(child);
      }
    });

    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      this.camera.position.set(
        center.x + maxDim,
        center.y + maxDim,
        center.z + maxDim
      );
      this.camera.lookAt(center);
    }
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    const canvas = this.canvasRef.nativeElement;
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  triggerFileInput() {
    this.fileInputRef.nativeElement.click();
  }
}
