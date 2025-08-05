// Event utilities placeholder
export function createEvent(type: string, data: any) {
  return {
    id: Math.random().toString(36).substring(2, 15),
    type,
    data,
    timestamp: new Date()
  };
}