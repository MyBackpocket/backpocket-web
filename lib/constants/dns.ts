/**
 * DNS configuration constants and provider documentation links.
 * Used in the Settings page for custom domain setup.
 *
 * IMPORTANT: This file must remain dependency-free (no next/*, no React)
 * to ensure it can be safely imported anywhere.
 */

/** Vercel DNS targets for domain configuration */
export const vercelDns = {
  /** CNAME target for subdomains (e.g., backpocket.yourdomain.com) */
  cname: "cname.vercel-dns.com",
  /** A record IP for apex/root domains (e.g., yourdomain.com) */
  aRecord: "76.76.21.21",
} as const;

/** DNS provider documentation links */
export const dnsProviderGuides = {
  cloudflare: {
    name: "Cloudflare",
    url: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  },
  namecheap: {
    name: "Namecheap",
    url: "https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-a-cname-record-for-my-domain/",
  },
  porkbun: {
    name: "Porkbun",
    url: "https://kb.porkbun.com/article/68-how-to-edit-dns-records",
  },
  squarespace: {
    name: "Squarespace",
    url: "https://support.squarespace.com/hc/en-us/articles/360002101888",
  },
  godaddy: {
    name: "GoDaddy",
    url: "https://www.godaddy.com/help/add-a-cname-record-19236",
  },
} as const;

/** Ordered array of DNS providers for rendering */
export const dnsProviderList = [
  dnsProviderGuides.cloudflare,
  dnsProviderGuides.namecheap,
  dnsProviderGuides.porkbun,
  dnsProviderGuides.squarespace,
  dnsProviderGuides.godaddy,
] as const;
