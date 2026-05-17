declare module 'ngeohash' {
  const ngeohash: {
    encode(latitude: number, longitude: number, precision?: number): string;
    decode(hash: string): { latitude: number; longitude: number };
  };
  export default ngeohash;
}
