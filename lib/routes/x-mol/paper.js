const got = require('@/utils/got');
const cheerio = require('cheerio');
const utils = require('./utils');

module.exports = async (ctx) => {
    const type = ctx.params.type;
    const magazine = ctx.params.magazine;
    const path = `paper/${type}/${magazine}`;
    const response = await got(path, {
        method: 'GET',
        prefixUrl: utils.host,
        headers: {
            Cookie: 'closeFloatWindow=true; journalIndexViewType=list; journalSort=publishDate',
        },
    });
    const data = response.data;
    const $ = cheerio.load(data);

    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const newsitem = $('.magazine-text');

    const item = await Promise.all(
        newsitem
            .map(async (index, element) => {
                const news = $(element);

                const a = news.find('.magazine-text-title').find('a');
                const title = a.text();
                const link = utils.host + a.attr('href');

                const detailLink = link.replace('Redirect', '');
                const detail = await ctx.cache.tryGet(detailLink, async () => {
                    const result = await got.get(detailLink);
                    const $ = cheerio.load(result.data);
                    const text = $('.maga-content');
                    text.find('span')
                        .last()
                        .remove();
                    return text
                        .html()
                        .trim()
                        .replace(/\n|\r/g, '')
                        .replace(/^.*?DOI:.*?>/g, 'DOI: ')
                        .replace(/<table.*(<img.*?>).*<\/table>/gm, '$1');
                });

                const description = detail;
                const span = news.find('.magazine-text-atten');
                const arr = span.map((index, element) => $(element).text()).get();
                const author = arr[1];
                const date = utils.getDate(arr[0]);
                const pubDate = utils.transDate(date);

                const single = {
                    title: title,
                    link: link,
                    description: description,
                    author: author,
                    pubDate: pubDate,
                };
                return Promise.resolve(single);
            })
            .get()
    );

    ctx.state.data = {
        title: title,
        link: response.url,
        description: description,
        item: item,
    };
};
