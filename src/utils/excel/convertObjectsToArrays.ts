export default function convertObjectsToArrays(data: any[]): any[] {
  if (data.length === 0) return [];

  const headers = Object.keys(data[0]);
  const rows = data.map((obj) => headers.map((key) => obj[key]));

  return [headers, ...rows];
}