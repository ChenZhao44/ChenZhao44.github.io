import { getCollection } from "astro:content";
import { siteConfig } from "@/site.config";
import rss from "@astrojs/rss";

export const GET = async () => {
	const publications = await getCollection("publication");

	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: import.meta.env.SITE,
		items: publications.map((publication) => ({
			title: publication.data.title,
			pubDate: publication.data.publishDate,
			link: `publications/${publication.id}/`,
		})),
	});
};
