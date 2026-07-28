import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

export interface DriveExportResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  fileName?: string;
  error?: string;
}

// Request Access Token from Google GIS Token Client
export function getDriveAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    // If google GIS client script is loaded
    if (window.google?.accounts?.oauth2) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: '185292973543-applet.apps.googleusercontent.com', // standard client
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
          } else if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('Gagal mendapatkan token akses Google Drive.'));
          }
        },
      });
      client.requestAccessToken();
    } else {
      // Prompt user or reject if script missing
      reject(new Error('Google Identity Services SDK tidak tersedia di browser.'));
    }
  });
}

// Upload Blob or Text File to Google Drive
export async function uploadToGoogleDrive(
  token: string,
  fileName: string,
  mimeType: string,
  content: Blob | string,
  folderName: string = 'Laporan Resmi Sekolah SD'
): Promise<DriveExportResult> {
  try {
    const fileBlob = typeof content === 'string' 
      ? new Blob([content], { type: mimeType })
      : content;

    // Create file metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      description: `Dokumen resmi SISFO SD yang diekspor otomatis pada ${new Date().toLocaleString('id-ID')}`
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', fileBlob);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive API error (${response.status}): ${errText}`);
    }

    const data = await response.json();

    // Log to Firestore collection 'driveExports'
    try {
      await addDoc(collection(db, 'driveExports'), {
        fileId: data.id,
        fileName: fileName,
        webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
        exportedAt: new Date().toISOString(),
        folderName
      });
    } catch (dbErr) {
      console.warn('Failed to record drive export in firestore:', dbErr);
    }

    return {
      success: true,
      fileId: data.id,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
      fileName: fileName
    };
  } catch (err: any) {
    console.error('Upload to Google Drive failed:', err);
    return {
      success: false,
      error: err.message || 'Gagal mengunggah file ke Google Drive.'
    };
  }
}
