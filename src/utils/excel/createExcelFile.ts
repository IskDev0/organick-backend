import * as XLSX from 'xlsx';
import { Data } from "hono/dist/types/context";

export default function createExcelFile( data:any, fileName: string): Data {
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, fileName);

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}