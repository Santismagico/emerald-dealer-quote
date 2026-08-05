import { describe, expect, it } from 'vitest';
import noticeSource from '../../../docs/legal/aviso-tratamiento-datos.md?raw';
import privacySource from '../../../docs/legal/politica-privacidad.md?raw';
import termsSource from '../../../docs/legal/terminos-servicio.md?raw';
import { NOTICE_VERSION, PRIVACY_VERSION, TERMS_VERSION } from './auth';

const documents = [
  ['términos', termsSource, TERMS_VERSION],
  ['privacidad', privacySource, PRIVACY_VERSION],
  ['aviso', noticeSource, NOTICE_VERSION]
] as const;

describe('documentos legales visibles', () => {
  it('mantiene la advertencia de borrador mientras existan campos pendientes', () => {
    for (const [name, source] of documents) {
      if (source.includes('[COMPLETAR')) {
        expect(source, name).toContain('BORRADOR — pendiente de revisión profesional');
      }
    }
  });

  it('muestra la misma versión técnica que queda registrada en la cuenta', () => {
    for (const [name, source, version] of documents) {
      expect(source, name).toContain(`Versión técnica: \`${version}\``);
    }
  });
});
