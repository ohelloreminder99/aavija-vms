import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    // In a production environment, you would use standard process.env.NEXT_PUBLIC_SITE_URL
    // For local/demo, we assume a standard domain structure
    const baseUrl = 'https://aavija.com';

    return [
        {
            url: `${baseUrl}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/auth/login`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/auth/signup`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
    ];
}
