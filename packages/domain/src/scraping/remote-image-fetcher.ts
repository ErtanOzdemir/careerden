export interface RemoteImage {
  body: Buffer;
  contentType: string;
}

export interface RemoteImageFetcher {
  fetch(url: string): Promise<RemoteImage>;
}
