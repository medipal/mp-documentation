import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Medipal Documentation",
  description: "Developer documentation for the Medipal platform",
  base: "/mp-documentation/",

  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        href: "/mp-documentation/logo-icon.png",
      },
    ],
  ],

  themeConfig: {
    logo: {
      light: "/logo.svg",
      dark: "/logo-dark.svg",
      height: 32,
    },
    siteTitle: false,

    nav: [{ text: "Guide", link: "/guide/" }],

    sidebar: {
      "/guide/": [
        {
          text: "Getting Started",
          items: [{ text: "Introduction", link: "/guide/" }],
        },
      ],
    },

    search: {
      provider: "local",
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/medipal/mp-documentation",
      },
    ],

    footer: {
      message:
        'Medipal Documentation &nbsp;|&nbsp; <a href="https://medipal.github.io/mp-documentation/" target="_blank">https://medipal.github.io/mp-documentation/</a>',
    },
  },

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
});
