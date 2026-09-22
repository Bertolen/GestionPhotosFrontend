import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe pour formater les dates.
 * Affiche les dates sous la forme : JJ/MM/AAAA HH:MM:SS
 */
@Pipe({
  name: 'dateFormat',
  standalone: true
})
export class DateFormatPipe implements PipeTransform {
  
  transform(value: Date | string | null): string {
    if (!value) {
      return 'N/A';
    }
    
    let date: Date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else {
      return 'N/A';
    }
    
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    
    // Formater la date en français
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

/**
 * Pipe pour afficher uniquement la date (sans l'heure).
 */
@Pipe({
  name: 'dateOnly',
  standalone: true
})
export class DateOnlyPipe implements PipeTransform {
  
  transform(value: Date | string | null): string {
    if (!value) {
      return 'N/A';
    }
    
    let date: Date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else {
      return 'N/A';
    }
    
    if (isNaN(date.getTime())) {
      return 'Date invalide';
    }
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}

/**
 * Pipe pour afficher uniquement l'heure.
 */
@Pipe({
  name: 'timeOnly',
  standalone: true
})
export class TimeOnlyPipe implements PipeTransform {
  
  transform(value: Date | string | null): string {
    if (!value) {
      return 'N/A';
    }
    
    let date: Date;
    
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else {
      return 'N/A';
    }
    
    if (isNaN(date.getTime())) {
      return 'Heure invalide';
    }
    
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
