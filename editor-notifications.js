// First-party MIT-licensed replacement for the upstream notification-only dependency.
const announce = (text, seconds = 4, kind = 'success') => {
  const toast = document.createElement('div');
  toast.className = 'prism-engine-toast ' + kind;
  toast.setAttribute('role',kind === 'error' ? 'alert' : 'status');
  toast.textContent = String(text);
  document.body.append(toast);
  const close = () => toast.remove();
  toast.addEventListener('click',close);
  setTimeout(close,Math.max(2,Number(seconds) || 4) * 1000);
  return { dismiss:close, setContent:content => {toast.textContent = String(content); return toast;} };
};
export default {
  success:(text,seconds) => announce(text,seconds),
  error:(text,seconds) => announce(text,seconds,'error'),
  warning:(text,seconds) => announce(text,seconds,'warning'),
};
