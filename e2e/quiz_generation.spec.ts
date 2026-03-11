import { test, expect } from '@playwright/test';

test('Quiz generation flow', async ({ page }) => {
  // 1. Navigasi ke root URL
  await page.goto('/');

  // 2. Klik tab "Manual"
  const manualTab = page.getByRole('button', { name: 'Manual' });
  await manualTab.click();

  // 3. Ketik topik di textarea
  const textarea = page.getByPlaceholder('Paste materi kuliah, artikel, atau tulis topik spesifik di sini...');
  await textarea.fill('Sejarah Kemerdekaan Indonesia');

  // 4. Klik tombol "Mulai Magic"
  const startButton = page.getByRole('button', { name: 'Mulai Magic' });
  
  // Pastikan tombol tidak disabled (mungkin butuh API key di real env)
  // Untuk keperluan testing foundation, kita asumsikan tombol dapat diklik
  await startButton.click();

  // 5. Tunggu layar "Quiz Active" muncul
  // Kita mencari elemen h2 yang berisi teks pertanyaan yang di-generate
  const questionHeading = page.locator('h2');
  await expect(questionHeading).toBeVisible({ timeout: 30000 }); // AI generation might take time
});
