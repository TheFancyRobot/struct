type Theme = 'light' | 'dark'

export async function waitForThemeStyles(
  page: import('playwright').Page,
  theme: Theme,
): Promise<void> {
  await page.waitForFunction(
    ({ expectedTheme, expectedBackground }) => {
      const shell = document.querySelector('.app-shell')
      return document.documentElement.dataset.theme === expectedTheme
        && shell?.getAttribute('data-theme') === expectedTheme
        && getComputedStyle(document.documentElement).backgroundColor === expectedBackground
    },
    {
      expectedTheme: `struct-${theme}`,
      expectedBackground: theme === 'light' ? 'rgb(247, 249, 253)' : 'rgb(16, 23, 37)',
    },
    { timeout: 5_000 },
  )
}
