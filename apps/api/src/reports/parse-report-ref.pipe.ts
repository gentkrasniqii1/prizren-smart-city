import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isReportPublicId } from './public-id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseReportRefPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const ref = value?.trim() ?? '';
    if (isReportPublicId(ref) || UUID_PATTERN.test(ref)) {
      return isReportPublicId(ref) ? ref.toUpperCase() : ref.toLowerCase();
    }
    throw new BadRequestException('id must be a report UUID or publicId (PRZ-YYYY-NNNNNN)');
  }
}
