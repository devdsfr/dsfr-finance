import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {
    console.log('🔧 API Base URL:', this.base);
  }

  /**
   * Fire-and-forget request to wake a sleeping backend.
   * O plano free do Render derruba o serviço após 15 min de inatividade e o
   * cold start leva vários segundos. Chamado na tela de login para o backend
   * já estar quente quando o dashboard pedir os dados.
   */
  warmUp(): void {
    this.http.get(`${this.base}/health`).subscribe({ next: () => {}, error: () => {} });
  }

  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          if (Array.isArray(v)) v.forEach(val => p = p.append(k, val));
          else p = p.set(k, v);
        }
      });
    }
    return this.http.get<T>(`${this.base}${path}`, { params: p });
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  patch<T>(path: string, body?: any): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body ?? {});
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`);
  }

  // Blob download for CSV/Excel export (AC-RL-21)
  download(path: string, params?: Record<string, any>): Observable<Blob> {
    let p = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => v != null && (p = p.set(k, v)));
    return this.http.get(`${this.base}${path}`, { params: p, responseType: 'blob' });
  }
}
