import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadResponse {
  success: boolean;
  fileName: string;
  originalName: string;
  size: number;
  uploadPath: string;
}

@Injectable({
  providedIn: 'root'
})
export class IfcService {
  private apiUrl = 'http://localhost:57750/api/ifc';

  constructor(private http: HttpClient) { }

  uploadFile(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData);
  }

  getUploadedFiles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/files`);
  }
}
