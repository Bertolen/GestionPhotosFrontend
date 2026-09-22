import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe pour formater la taille des fichiers en Ko, Mo, Go, etc.
 * Exemples :
 * - 1024 → "1 Ko"
 * - 1048576 → "1 Mo"
 * - 1073741824 → "1 Go"
 */
@Pipe({
  name: 'fileSize',
  standalone: true
})
export class FileSizePipe implements PipeTransform {
  
  private static readonly UNITS = ['octets', 'Ko', 'Mo', 'Go', 'To'];
  private static readonly THRESHOLD = 1024;

  transform(bytes: number | null): string {
    if (bytes === null || bytes === undefined) {
      return 'N/A';
    }
    
    if (bytes === 0) {
      return '0 octets';
    }
    
    let size = Math.abs(bytes);
    let unitIndex = 0;
    
    while (size >= this.THRESHOLD && unitIndex < this.UNITS.length - 1) {
      size /= this.THRESHOLD;
      unitIndex++;
    }
    
    // Formater avec 2 décimales pour les valeurs non entières
    const formattedSize = size >= 100 || unitIndex === 0 
        ? size.toFixed(0)
        : size.toFixed(2);
    
    return `${formattedSize} ${this.UNITS[unitIndex]}`;
  }
}
