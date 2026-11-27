'use strict';

// Copy the email address, and say what happened.
const copyButton = document.querySelector('[data-copy]');
const copyStatus = document.querySelector('[data-copy-status]');

copyButton.addEventListener('click', async () => {
  const email = copyButton.dataset.copy;

  try {
    await navigator.clipboard.writeText(email);
    copyStatus.textContent = 'Email address copied.';
  } catch {
    copyStatus.textContent = 'Copying is blocked here. Select the address above to copy it.';
  }
});
