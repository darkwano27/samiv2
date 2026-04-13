import {
  BadRequestException,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const flat = result.error.flatten();
      const issueBits = result.error.issues.slice(0, 4).map((i) => {
        const p = i.path.length ? i.path.join('.') : 'body';
        return `${p}: ${i.message}`;
      });
      throw new BadRequestException({
        message: issueBits.length ? `Validation failed: ${issueBits.join('; ')}` : 'Validation failed',
        errors: flat,
      });
    }
    return result.data;
  }
}
