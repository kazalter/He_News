/**
 * 鸣潮官网资讯 parser 的回归测试。
 *
 * 这个 parser 靠官网静态 JSON 的固定字段名（articleId / articleTitle /
 * articleDesc / startTime）+ 正文 HTML 里的首图当封面。官网换字段或换结构会让
 * 映射 silently 变空。下面用按真实 ArticleMenu.json 缩写的样本钉死：
 *   - 按发布时间（startTime）倒序；
 *   - 缺 id / 缺标题的脏数据被丢；
 *   - 详情页链接拼成 mc.kurogames.com/main/news/detail/<id>；
 *   - 正文首图当封面、标签被剥成纯文本。
 */
import {
  parseArticleMenu,
  toNewsArticle,
  extractContent,
} from './index';

const JSON_BASE =
  'https://media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/zh';

const MENU_FIXTURE = [
  {
    articleId: 4609,
    articleTitle: '「自星海尽处回响」3.3版本内容说明',
    articleType: 52,
    articleDesc: '',
    createTime: '2026-04-29 18:28:08',
    startTime: '2026-04-30 10:00:00',
    suggestCover: '',
    top: 1,
  },
  {
    articleId: 704,
    articleTitle: '《鸣潮》公测定档5月23日 全平台预约已开启',
    articleType: 51,
    articleDesc: '鸣潮往复，文明不屈。《鸣潮》将于2024年5月23日开启全球同步公测。',
    createTime: '2024-04-09 17:39:38',
    startTime: '2024-04-09 17:38:37',
    suggestCover: 'https://example.com/cover-704.jpg',
    top: 0,
  },
  // 脏数据：缺标题 + 缺 id，都应被丢。
  { articleId: 999, articleTitle: '', startTime: '2026-01-01 00:00:00' },
  { articleTitle: '没有 id 的条目', startTime: '2026-01-01 00:00:00' },
];

describe('parseArticleMenu', () => {
  const metas = parseArticleMenu(MENU_FIXTURE);

  it('按发布时间倒序，最新版本说明排在最前', () => {
    expect(metas.map((m) => m.articleId)).toEqual([4609, 704]);
  });

  it('映射 id / 标题 / 简介 / 发布时间（北京时间）', () => {
    expect(metas[1]).toMatchObject({
      articleId: 704,
      title: '《鸣潮》公测定档5月23日 全平台预约已开启',
      desc: expect.stringContaining('文明不屈'),
    });
    // startTime 按 +08:00 解释
    expect(metas[1].publishedAt?.toISOString()).toBe('2024-04-09T09:38:37.000Z');
  });

  it('缺 id / 缺标题的脏数据被丢', () => {
    expect(metas).toHaveLength(2);
  });

  it('非数组输入返回空', () => {
    expect(parseArticleMenu(null)).toEqual([]);
    expect(parseArticleMenu({ list: [] })).toEqual([]);
  });
});

describe('extractContent', () => {
  it('剥标签成纯文本、取首图当封面', () => {
    const html =
      '<div><img src="https://cdn.example.com/a.jpg" alt=""><p>正文<strong>内容</strong>段落</p></div>';
    expect(extractContent(html)).toEqual({
      text: '正文内容段落',
      coverUrl: 'https://cdn.example.com/a.jpg',
    });
  });

  it('没有图片时封面为 undefined', () => {
    expect(extractContent('<p>纯文字</p>').coverUrl).toBeUndefined();
  });
});

describe('toNewsArticle', () => {
  const metas = parseArticleMenu(MENU_FIXTURE);
  const latest = metas[0];

  it('详情页链接拼成官网 news/detail/<id>', () => {
    const article = toNewsArticle(latest, JSON_BASE);
    expect(article.url).toBe(
      'https://mc.kurogames.com/main/news/detail/4609',
    );
    expect(article.title).toBe('「自星海尽处回响」3.3版本内容说明');
    expect(article.publishedAt?.toISOString()).toBe(
      '2026-04-30T02:00:00.000Z',
    );
  });

  it('有正文时用正文首图当封面、正文纯文本进 content', () => {
    const detail = {
      articleContent:
        '<div><img src="https://cdn.example.com/3-3.jpg"><p>维护时间及补偿说明</p></div>',
    };
    const article = toNewsArticle(latest, JSON_BASE, detail);
    expect(article.coverUrl).toBe('https://cdn.example.com/3-3.jpg');
    expect(article.content).toContain('维护时间');
  });

  it('articleDesc 优先当摘要；没有正文也不报错', () => {
    const withDesc = metas[1];
    const article = toNewsArticle(withDesc, JSON_BASE);
    expect(article.summary).toContain('文明不屈');
    expect(article.coverUrl).toBe('https://example.com/cover-704.jpg');
  });
});
