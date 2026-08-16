export {};

declare global {
  interface SubtleCrypto {
    /**
     * Compatibilidade de tipagem para TypeScript + @cloudflare/workers-types.
     * Os buffers processados pela V70 vêm de Response.arrayBuffer()/uploads,
     * mas Uint8Array.buffer é tipado como ArrayBufferLike nas libs atuais.
     */
    digest(algorithm: AlgorithmIdentifier, data: ArrayBufferLike): Promise<ArrayBuffer>;
  }
}
