export type PasswordSafetyResult =
  | { ok: true }
  | { ok: false; code: 'PASSWORD_PWNED' | 'PASSWORD_SCREENING_UNAVAILABLE'; message: string };

const textEncoder = new TextEncoder();

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function sha1(value: string) {
  return hex(await crypto.subtle.digest('SHA-1', textEncoder.encode(value)));
}

/**
 * Consulta o Pwned Passwords usando k-anonymity: somente os cinco primeiros
 * caracteres do SHA-1 deixam o Worker. A senha e o hash completo nunca são
 * enviados ao serviço externo.
 */
export async function checkPasswordSafety(password: string): Promise<PasswordSafetyResult> {
  const hash = await sha1(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  let response: Response;
  try {
    response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        accept: 'text/plain',
        'add-padding': 'true',
        'user-agent': 'ASTERYON-Catalog-PasswordSafety/1.0',
      },
      signal: AbortSignal.timeout(4500),
    });
  } catch {
    return {
      ok: false,
      code: 'PASSWORD_SCREENING_UNAVAILABLE',
      message: 'Não foi possível validar a segurança da senha agora. Tente novamente em instantes.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'PASSWORD_SCREENING_UNAVAILABLE',
      message: 'Não foi possível validar a segurança da senha agora. Tente novamente em instantes.',
    };
  }

  const compromised = (await response.text())
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .some(line => {
      const [candidate, count] = line.split(':');
      return candidate?.toUpperCase() === suffix && Number(count || 0) > 0;
    });

  if (compromised) {
    return {
      ok: false,
      code: 'PASSWORD_PWNED',
      message: 'Esta senha aparece em vazamentos conhecidos. Escolha uma senha diferente e exclusiva.',
    };
  }

  return { ok: true };
}
