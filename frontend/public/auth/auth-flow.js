(() => {
  'use strict';
  const mode = document.body.dataset.authMode || '';
  const statusBox = document.getElementById('auth-status');
  const confirmActions = document.getElementById('confirm-actions');
  const resetActions = document.getElementById('reset-actions');
  const recoveryForm = document.getElementById('recovery-form');
  const passwordForm = document.getElementById('password-form');
  const recoveryEmail = document.getElementById('recovery-email');
  const newPassword = document.getElementById('new-password');
  const confirmPassword = document.getElementById('confirm-password');

  function showStatus(message, kind = '') {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `auth-status is-visible${kind ? ` is-${kind}` : ''}`;
  }
  function setLoading(form, loading) {
    if (!form) return;
    form.classList.toggle('is-loading', loading);
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = loading;
  }
  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }, ...options,
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok || !payload?.ok) {
      const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.');
      error.code = payload?.error?.code || 'REQUEST_FAILED';
      throw error;
    }
    return payload;
  }
  function authParams() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const search = new URLSearchParams(location.search);
    const get = key => hash.get(key) || search.get(key) || '';
    return {
      accessToken: get('access_token'), refreshToken: get('refresh_token'),
      expiresIn: Number(get('expires_in')) || 3600, type: get('type'),
      error: get('error'), errorCode: get('error_code'), errorDescription: get('error_description'),
    };
  }
  function clearSensitiveUrl() {
    if (!location.hash && !location.search) return;
    history.replaceState({}, document.title, location.pathname);
  }
  async function consumeEmailSession() {
    const params = authParams();
    if (params.error || params.errorCode) {
      clearSensitiveUrl();
      const expired = params.errorCode === 'otp_expired' || /expired|invalid/i.test(params.errorDescription || '');
      throw new Error(expired ? 'Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.' : (params.errorDescription || 'O link de autenticação não pôde ser validado.'));
    }
    if (!params.accessToken) return { consumed: false, type: params.type };
    try {
      const result = await api('/api/auth/account/session', {
        method: 'POST', body: JSON.stringify({ accessToken: params.accessToken, refreshToken: params.refreshToken, expiresIn: params.expiresIn, type: params.type }),
      });
      return { consumed: true, type: params.type, user: result.user };
    } finally { clearSensitiveUrl(); }
  }
  async function sessionStatus() { return api('/api/auth/account/session', { method: 'GET', headers: {} }); }
  async function initConfirm() {
    showStatus('Validando o link de confirmação…');
    try {
      const consumed = await consumeEmailSession();
      const state = await sessionStatus();
      if (state.authenticated) {
        showStatus('E-mail confirmado e sessão validada com segurança.', 'success');
        if (confirmActions) confirmActions.hidden = false;
        const passwordLink = document.getElementById('define-password-link');
        if (passwordLink && !['invite', 'recovery'].includes(consumed.type || '')) passwordLink.textContent = 'Definir ou alterar senha';
        return;
      }
      if (!consumed.consumed) showStatus('Não há uma sessão de confirmação ativa. Se o link expirou, solicite uma recuperação de senha.', 'error');
    } catch (error) {
      showStatus(error.message || 'Não foi possível validar o link.', 'error');
      if (confirmActions) confirmActions.hidden = false;
    }
  }
  async function initReset() {
    try { await consumeEmailSession(); } catch (error) { showStatus(error.message || 'O link de recuperação não pôde ser validado.', 'error'); }
    try {
      const state = await sessionStatus();
      if (state.authenticated) {
        if (recoveryForm) recoveryForm.hidden = true;
        if (passwordForm) passwordForm.hidden = false;
        showStatus('Sessão validada. Defina agora sua nova senha.', 'success');
      } else if (recoveryForm) {
        recoveryForm.hidden = false;
        if (passwordForm) passwordForm.hidden = true;
      }
    } catch {
      if (recoveryForm) recoveryForm.hidden = false;
    }
  }
  recoveryForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = String(recoveryEmail?.value || '').trim().toLowerCase();
    if (!email) return;
    setLoading(recoveryForm, true);
    try {
      const result = await api('/api/auth/account/recovery', { method: 'POST', body: JSON.stringify({ email }) });
      showStatus(result.message || 'Se a conta existir, o e-mail de recuperação será enviado.', 'success');
    } catch (error) { showStatus(error.message || 'Não foi possível solicitar a recuperação.', 'error'); }
    finally { setLoading(recoveryForm, false); }
  });
  passwordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const password = String(newPassword?.value || '');
    const confirmation = String(confirmPassword?.value || '');
    if (password.length < 10) { showStatus('A nova senha precisa ter pelo menos 10 caracteres.', 'error'); return; }
    if (password !== confirmation) { showStatus('As duas senhas informadas não são iguais.', 'error'); return; }
    setLoading(passwordForm, true);
    try {
      const result = await api('/api/auth/account/password', { method: 'PUT', body: JSON.stringify({ password }) });
      passwordForm.hidden = true;
      if (resetActions) resetActions.hidden = false;
      showStatus(result.message || 'Senha definida com sucesso.', 'success');
      if (newPassword) newPassword.value = '';
      if (confirmPassword) confirmPassword.value = '';
    } catch (error) { showStatus(error.message || 'Não foi possível atualizar a senha.', 'error'); }
    finally { setLoading(passwordForm, false); }
  });
  if (mode === 'confirm') initConfirm();
  if (mode === 'reset') initReset();
})();
