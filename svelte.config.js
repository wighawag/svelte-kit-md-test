import preprocess from 'svelte-preprocess';
import adapter_ipfs from 'sveltejs-adapter-ipfs';

import {mdsvex} from 'mdsvex';
import remarkGFM from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkUnwrapImages from 'remark-unwrap-images';
import remarkWikiLinks from 'remark-wiki-link';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import rehypeMathJax from 'rehype-mathjax';

import {execSync} from 'child_process';
import {visit} from 'unist-util-visit';

import fs from 'fs';
import path from 'path';
function listFolder(dir, files=[]) {
	fs.readdirSync(dir).forEach(f => {
		let dirPath = path.join(dir, f);
		let isDirectory = fs.statSync(dirPath).isDirectory();
		isDirectory
		? listFolder(dirPath, files)
		: files.push(path.join(dir, f));
	});
	return files;
}

const pages = 'foam-pages';
const assets = 'static';
const filepaths = listFolder(pages);
const pagesAbsoultePath = path.resolve(pages);
const pagePaths = filepaths.map(v => v.replace(/.md$/, '').replace(`${pages}/`, ''));
const permalinks = [];
const permalinkMap = {};
for (const pagepath of pagePaths) {
	// console.log({pagepath})
	const splitted = pagepath.split('/');
	for (let i = 1; i <= splitted.length; i++) {
		const permalink = splitted.slice(splitted.length - i).join('/');
		const existingPagePath = permalinkMap[permalink];
		let toRegister = true;
		if (existingPagePath) {
			const existingSpliited = existingPagePath.split('/');
			if (existingSpliited.length >= splitted.length) {
				toRegister = true;
			} else {
				toRegister = false;
			}
		}
		if (toRegister) {
			// console.log(`register: ${permalink} => ${pagepath}`);
			permalinkMap[permalink] = pagepath;
			permalinks.push(permalink);
		}
		
	}
}


let VERSION = Date.now();
try {
VERSION = execSync('git rev-parse --short HEAD', {stdio: 'ignore'}).toString().trim();
// eslint-disable-next-line no-empty
} catch(e) {}

let outputFolder = './build';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [
		preprocess(),
		mdsvex({
			extensions: ['.md'],
			remarkPlugins: [
			// 	() => {
			// 		let currentFilename;
			// 		function visitor(node, index, parent) {
			// 			if (node.url.endsWith('.md')) {
			// 				node.url = node.url.substr(0, node.url.length - 3);
			// 		 	}
			// 		}
			// 	  	function transform(tree, file) {
			// 			currentFilename = file.filename;
			// 			visit(tree, ['link'], visitor);
			// 		}				  
			// 		return transform;
			// 	},
				remarkMath,
				remarkGFM,
				[
					remarkWikiLinks,
					{
						permalinks,
						hrefTemplate(permalink) {
							// if (!permalinkMap[permalink]) {
							// 	console.error(`not found ${permalink}`)
							// }
							let pagepath = permalinkMap[permalink];
							if (!pagepath) {
								return ""; // make link noops
							}
							// console.log(`${permalink} => ${pagepath}`)
							if (pagepath.endsWith('/index')) {
								pagepath = pagepath.substr(0, pagepath.length - 6);
							}

							// absolute path and then relativize it via adapter (ipfs )
							if (!pagepath.startsWith('/')) {
								pagepath = "/" + pagepath;
							}
							return pagepath
						},
						wikiLinkClassName: 'internal wikilink'
					}
				],
				remarkUnwrapImages,
				
			],
			rehypePlugins: [
				rehypeMathJax,
				rehypeSlug,
				rehypeAutolinkHeadings,
				// rehype-foam-svelte-kit
				() => {
					let currentFilename;
					function visitor(node, index, parent) {
						let url;
						switch(node.tagName) {
							case 'a':
								url = node.properties.href;
								break;
							case 'img':
							case 'video':
							case 'audio':
								url = node.properties.src;
								break;
						}
						
						// only process internal links
						if (url && !url.startsWith('http')) {
							const currentRelativePath = path.relative(pagesAbsoultePath, currentFilename);

							// gather pathname, query and hash to ensure we can reconstruct them
							const splitOne = url.split('?');
							let pathname = '';
							let hash = '';
							let query = '';
							if (splitOne.length > 1) {
								pathname = splitOne[0];
								const splitTwo = splitOne[1].split('#');
								if (splitTwo.length > 1) {
									query = '?' + splitTwo[0];
									hash = '#' + splitTwo[1];
								} else {
									query = '?' + splitOne[1];
								}
							} else {
								const splitTwo = splitOne[0].split('#');
								if (splitTwo.length > 1) {
									pathname = splitTwo[0];
									hash = '#' + splitTwo[1];
								} else {
									pathname = splitOne[0];
								}
								
							}

							if (pathname.startsWith('/')) {
								// ignore absolute path
							} else {

								if (pathname !== '') {
									// pathname != current

									const urlLocalPath = path.join(path.dirname(currentFilename), pathname);
									let relative = path.relative(currentFilename, urlLocalPath);

									const relativeToAssets = path.relative(path.resolve(assets), urlLocalPath);
									if (relativeToAssets.startsWith('..')) {
										// use absolute path solve everything it seems
										pathname = "/" + path.join(currentRelativePath, relative);
									} else {
										// keep for static assets
										pathname = relative;

										if (currentRelativePath === 'index.md') {
											// special case for index, static assets is actually at level
											pathname = pathname.replace(`../../${assets}/`, '');
										} else {
											pathname = pathname.replace(`../${assets}/`, '');
										}
									}
								} else {
									// hash link in current page
									if (hash.length > 0) {
										// TODO better
										if (currentRelativePath.endsWith('.md')) {
											pathname = "/" + currentRelativePath.slice(0, currentRelativePath.length - 3) + '/';
										} else {
											pathname = "/" + currentRelativePath + '/';
										}
										
									}
	
								}
							}

							if (pathname.endsWith('.md')) {
								pathname = pathname.slice(0, pathname.length - 3);
							}

							if (pathname.endsWith('index')) {
								pathname = pathname.slice(0, pathname.length - 5);
							}

							if (pathname.endsWith('index/')) {
								pathname = pathname.slice(0, pathname.length - 6);
							}

							if (!pathname.endsWith('/') && !(pathname.lastIndexOf('.') > pathname.lastIndexOf('/'))) {
								pathname = pathname + '/'
							}

							switch(node.tagName) {
								case 'a':
									node.properties.href = pathname + query + hash;
									break;
								case 'img':
								case 'video':
								case 'audio':
									node.properties.src = pathname + query + hash;
									break;
							}
						}
					}
				  	function transform(tree, file) {
						currentFilename = file.filename;
						visit(tree, ['element'], visitor);
					}				  
					return transform;
				},
			],
	  	})
	],

	kit: {
		files: {
			routes: pages,
			template: 'template.html',
			assets: assets
		},
		adapter: adapter_ipfs({
		  assets: outputFolder,
		  pages: outputFolder,
		//   removeSourceMap: true,
		//   copyBeforeSourceMapRemoval: 'release',
		  removeBuiltInServiceWorkerRegistration: true,
		  injectPagesInServiceWorker: true,
		  injectDebugConsole: true,
		}),
		target: '#svelte',
		trailingSlash: 'ignore',
		vite: {
		  build: {
			sourcemap: true,
		  },
		  define: {
			__VERSION__: JSON.stringify(VERSION),
		  },
		},
	  },
};

export default config;
