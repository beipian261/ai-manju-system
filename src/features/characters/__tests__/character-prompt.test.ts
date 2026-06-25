import { describe, it, expect } from 'vitest';
import {
  buildCharacterSheet,
  buildCharacterPrompt,
  buildCharacterReferencePrompt,
  buildNegativePrompt,
  buildCharacterPortraitPrompt,
  enrichImagePrompt,
  extractCharacterImages,
  buildCharacterConsistencyInstructions,
} from '../character-prompt';

describe('character-prompt - buildCharacterSheet', () => {
  it('构建基本角色卡', () => {
    const sheet = buildCharacterSheet({
      name: '小明',
      age: '18',
      gender: 'male',
      personality: '开朗活泼',
      clothing: '黑色校服',
      hair: '黑色短发',
      eyes: '棕色眼睛',
    });

    expect(sheet.name).toBe('小明');
    expect(sheet.gender).toBe('male');
    expect(sheet.age).toContain('18');
    expect(sheet.hair).toContain('black');
    expect(sheet.eyes).toContain('brown');
    expect(sheet.outfit_main).toContain('uniform');
    expect(sheet.englishDescription.length).toBeGreaterThan(0);
  });

  it('默认性别为 female', () => {
    const sheet = buildCharacterSheet({ name: '小红' });
    expect(sheet.gender).toBe('female');
  });

  it('默认年龄为 young adult', () => {
    const sheet = buildCharacterSheet({ name: '角色A' });
    expect(sheet.age.length).toBeGreaterThan(0);
  });

  it('数字年龄正确转换（少年）', () => {
    const sheet = buildCharacterSheet({ name: '小明', age: '15' });
    expect(sheet.age).toContain('15');
    expect(sheet.age.toLowerCase()).toContain('youth');
  });

  it('数字年龄正确转换（中年）', () => {
    const sheet = buildCharacterSheet({ name: '王叔叔', age: '45' });
    expect(sheet.age).toContain('45');
    expect(sheet.age.toLowerCase()).toContain('middle');
  });

  it('中文年龄描述转换（少年）', () => {
    const sheet = buildCharacterSheet({ name: '小华', age: '少年' });
    expect(sheet.age.toLowerCase()).toContain('teenager');
  });

  it('中文年龄描述转换（中年）', () => {
    const sheet = buildCharacterSheet({ name: '老李', age: '中年' });
    expect(sheet.age.toLowerCase()).toContain('middle-aged');
  });

  it('中文年龄描述转换（老年）', () => {
    const sheet = buildCharacterSheet({ name: '爷爷', age: '老年' });
    expect(sheet.age.toLowerCase()).toContain('elderly');
  });

  it('发型发色翻译（黑色短发）', () => {
    const sheet = buildCharacterSheet({ name: 'A', hair: '黑色短发' });
    expect(sheet.hair.toLowerCase()).toContain('black');
    expect(sheet.hair.toLowerCase()).toContain('short');
  });

  it('发型发色翻译（金色长卷发）', () => {
    const sheet = buildCharacterSheet({ name: 'B', hair: '金色波浪卷发' });
    expect(sheet.hair.toLowerCase()).toContain('golden');
    expect(sheet.hair.toLowerCase()).toContain('wavy');
  });

  it('眼睛颜色翻译（蓝色大眼睛）', () => {
    const sheet = buildCharacterSheet({ name: 'C', eyes: '蓝色大眼睛' });
    expect(sheet.eyes.toLowerCase()).toContain('blue');
    expect(sheet.eyes.toLowerCase()).toContain('large');
  });

  it('体型翻译（高个子）', () => {
    const sheet = buildCharacterSheet({ name: 'D', build: '高挑修长' });
    expect(sheet.body.toLowerCase()).toContain('tall');
    expect(sheet.body.toLowerCase()).toContain('slender');
  });

  it('服装翻译（西装）', () => {
    const sheet = buildCharacterSheet({ name: 'E', clothing: '黑色西装' });
    expect(sheet.outfit_main.toLowerCase()).toContain('formal');
    expect(sheet.outfit_main.toLowerCase()).toContain('business');
  });

  it('服装翻译（汉服）', () => {
    const sheet = buildCharacterSheet({ name: 'F', clothing: '汉服' });
    expect(sheet.outfit_main.toLowerCase()).toContain('hanfu');
  });

  it('referenceImg 被加入 referenceImages', () => {
    const sheet = buildCharacterSheet({
      name: 'G',
      referenceImg: 'https://example.com/ref.jpg',
    });
    expect(sheet.referenceImages).toEqual(['https://example.com/ref.jpg']);
  });

  it('dnaSummary 优先用于 englishDescription', () => {
    const sheet = buildCharacterSheet({
      name: 'H',
      dnaSummary: 'optimized character dna data',
    });
    expect(sheet.englishDescription.startsWith('[DNA]')).toBe(true);
    expect(sheet.englishDescription).toContain('optimized character dna data');
  });

  it('没有 dnaSummary 时从字段拼接', () => {
    const sheet = buildCharacterSheet({
      name: '测试角色',
      gender: 'female',
      hair: '黑色长发',
    });
    expect(sheet.englishDescription).toContain('测试角色');
    expect(sheet.englishDescription).not.toContain('[DNA]');
  });

  it('signaturePose 被加入 signature_look', () => {
    const sheet = buildCharacterSheet({
      name: 'I',
      signaturePose: '手托下巴思考',
    });
    expect(sheet.signature_look).toContain('手托下巴思考');
  });
});

describe('character-prompt - buildCharacterPrompt', () => {
  it('返回字符串', () => {
    const result = buildCharacterPrompt({ name: '角色' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('character-prompt - buildCharacterReferencePrompt', () => {
  it('生成角色参考提示词', () => {
    const sheet = buildCharacterSheet({
      name: '小明',
      gender: 'male',
      hair: '黑色短发',
      eyes: '棕色眼睛',
    });
    const prompt = buildCharacterReferencePrompt(sheet, 'anime');

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('CONSISTENCY');
    expect(prompt).toContain('小明');
    expect(prompt).toContain('anime');
  });

  it('支持不同艺术风格', () => {
    const sheet = buildCharacterSheet({ name: '角色' });

    const animePrompt = buildCharacterReferencePrompt(sheet, 'anime');
    const comicPrompt = buildCharacterReferencePrompt(sheet, 'comic_book');

    expect(animePrompt).not.toBe(comicPrompt);
  });

  it('不超过最大长度', () => {
    const sheet = buildCharacterSheet({
      name: '角色名',
      personality: '非常复杂的性格描述，包含很多很多的细节和特征，比如勇敢善良聪明机智幽默风趣温柔体贴等等等的词语来增加长度',
      clothing: '一套非常华丽的服装，有很多装饰细节，包括金色的纽扣、丝绸的面料、精致的刺绣、飘逸的裙摆、闪亮的首饰等等',
    });

    const prompt = buildCharacterReferencePrompt(sheet, 'anime');
    expect(prompt.length).toBeLessThanOrEqual(2500);
  });
});

describe('character-prompt - buildNegativePrompt', () => {
  it('默认生成负向提示词', () => {
    const prompt = buildNegativePrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('动漫风格包含风格负向标签', () => {
    const prompt = buildNegativePrompt({ style: 'anime' });
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('漫画模式包含漫画负向标签', () => {
    const prompt = buildNegativePrompt({ isComic: true });
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('写实风格不包含动漫风格负向', () => {
    const animePrompt = buildNegativePrompt({ style: 'anime' });
    const realisticPrompt = buildNegativePrompt({ style: 'realistic' });

    expect(animePrompt.length).not.toBe(realisticPrompt.length);
  });
});

describe('character-prompt - buildCharacterPortraitPrompt', () => {
  it('生成角色肖像提示词', () => {
    const sheet = buildCharacterSheet({ name: '角色A' });
    const prompt = buildCharacterPortraitPrompt(sheet, 'anime');

    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('portrait');
    expect(prompt).toContain('centered');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('不超过最大长度', () => {
    const sheet = buildCharacterSheet({
      name: '非常长的角色名字用来测试',
      personality: '非常详细的性格描述包含很多很多很多的内容细节',
    });
    const prompt = buildCharacterPortraitPrompt(sheet, 'anime');
    expect(prompt.length).toBeLessThanOrEqual(2500);
  });
});

describe('character-prompt - enrichImagePrompt', () => {
  it('生成包含角色的图片提示词', () => {
    const sheet = buildCharacterSheet({ name: '小明', gender: 'male' });
    const prompt = enrichImagePrompt({
      sceneDescription: '公园里的男孩',
      characterSheets: [sheet],
      styleKey: 'anime',
    });

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('SCENE');
    expect(prompt).toContain('CONSISTENCY');
    expect(prompt).toContain('小明');
  });

  it('空角色列表也能生成', () => {
    const prompt = enrichImagePrompt({
      sceneDescription: '空荡的街道',
      characterSheets: [],
      styleKey: 'anime',
    });

    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('SCENE');
  });

  it('包含情绪和镜头信息', () => {
    const sheet = buildCharacterSheet({ name: '小红' });
    const prompt = enrichImagePrompt({
      sceneDescription: '一个女孩',
      characterSheets: [sheet],
      styleKey: 'anime',
      emotionHint: 'sad',
      cameraAngleHint: 'close_up',
    });

    expect(prompt).toContain('FRAMING');
    expect(prompt).toContain('MOOD');
  });

  it('包含光影/构图/色板/镜头运动信息', () => {
    const prompt = enrichImagePrompt({
      sceneDescription: '场景描述',
      characterSheets: [],
      styleKey: 'anime',
      lightingHint: 'neon',
      compositionHint: 'symmetry',
      colorPaletteHint: 'cool_blue',
      cameraMovementHint: 'tracking_shot',
    });

    expect(prompt).toContain('LIGHTING');
    expect(prompt).toContain('COMPOSITION');
    expect(prompt).toContain('COLOR');
  });

  it('漫画风格添加漫画质量标签', () => {
    const comicPrompt = enrichImagePrompt({
      sceneDescription: 'test',
      characterSheets: [],
      styleKey: 'comic_book',
    });

    const animePrompt = enrichImagePrompt({
      sceneDescription: 'test',
      characterSheets: [],
      styleKey: 'anime',
    });

    expect(comicPrompt.length).toBeGreaterThan(animePrompt.length);
  });

  it('不超过最大长度', () => {
    const sheets = Array.from({ length: 10 }, (_, i) =>
      buildCharacterSheet({
        name: `角色${i}`,
        personality: '非常详细的性格描述包含很多内容',
        clothing: '非常详细的服装描述包含很多细节和装饰',
      })
    );

    const prompt = enrichImagePrompt({
      sceneDescription: '一个非常非常非常非常非常非常长的场景描述，用来测试最大长度限制是否正常工作，确保不会超过模型的 token 限制',
      characterSheets: sheets,
      styleKey: 'anime',
      emotionHint: 'very detailed emotion description',
      cameraAngleHint: 'very detailed camera description',
      visualKeywords: 'many many many many many many visual keywords to make the prompt longer',
    });

    expect(prompt.length).toBeLessThanOrEqual(2500);
  });
});

describe('character-prompt - extractCharacterImages', () => {
  it('从角色列表中提取参考图', () => {
    const characters = [
      { referenceImg: 'https://a.com/1.jpg' },
      { referenceImg: null },
      { referenceImg: 'https://a.com/2.jpg' },
      { referenceImg: undefined },
      { referenceImg: '' },
    ];

    const images = extractCharacterImages(characters);
    expect(images).toEqual(['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  });

  it('空列表返回空数组', () => {
    expect(extractCharacterImages([])).toEqual([]);
  });
});

describe('character-prompt - buildCharacterConsistencyInstructions', () => {
  it('生成角色一致性指令', () => {
    const characters = [
      { name: '小明', gender: '男', age: '18', hair: '黑发', clothing: '校服' },
      { name: '小红', gender: '女', age: '17', hair: '棕发', clothing: '校服' },
    ];

    const result = buildCharacterConsistencyInstructions(characters);
    expect(typeof result).toBe('string');
    expect(result).toContain('小明');
    expect(result).toContain('小红');
    expect(result).toContain('角色设定');
  });

  it('空角色列表返回空字符串', () => {
    const result = buildCharacterConsistencyInstructions([]);
    expect(result).toBe('');
  });

  it('包含角色的各种属性', () => {
    const characters = [
      {
        name: '测试角色',
        gender: '男',
        age: '20',
        appearance: '英俊',
        hair: '短发',
        eyes: '大眼',
        clothing: '运动装',
      },
    ];

    const result = buildCharacterConsistencyInstructions(characters);
    expect(result).toContain('外貌');
    expect(result).toContain('发型');
    expect(result).toContain('眼睛');
    expect(result).toContain('服装');
  });
});
