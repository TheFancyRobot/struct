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
      // html background = DaisyUI --root-bg = --struct-background (brand page bg).
      expectedBackground: theme === 'light' ? 'rgb(248, 250, 252)' : 'rgb(2, 6, 23)',
    },
    { timeout: 15_000 },
  )
}
