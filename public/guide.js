const savedTheme = localStorage.getItem('theta-workplace-theme');
const savedLanguage = localStorage.getItem('theta-workplace-language') || 'tr';
const themeButton = document.querySelector('#guide-theme-toggle');

function applyLanguage(language) {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-tr][data-en]').forEach(element => { element.textContent = element.dataset[language]; });
  document.querySelectorAll('.language-button').forEach(button => button.classList.toggle('active', button.dataset.language === language));
  localStorage.setItem('theta-workplace-language', language);
}

function applyTheme(isDark) {
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeButton.textContent = isDark ? '☀' : '☾';
  themeButton.title = isDark ? 'Açık temaya geç' : 'Siyah temaya geç';
}

document.querySelectorAll('.language-button').forEach(button => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
themeButton.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme !== 'dark'));
applyLanguage(savedLanguage);
applyTheme(savedTheme === 'dark');
