import { describe, it, expect } from 'vitest';
import { parseScriptToStoryboards, getScriptMetadata } from '../script-parser';

describe('script-parser - 文本格式解析', () => {
  it('解析单场景文本', () => {
    const script = `场景1:
描述: 一个阳光明媚的下午，公园长椅上坐着一个女孩
对白: 今天天气真好啊
镜头: 中景
情绪: 平静`;

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(1);
    expect(frames[0].scene_number).toBe(1);
    expect(frames[0].description).toContain('公园');
    expect(frames[0].dialogue).toBe('今天天气真好啊');
  });

  it('解析多场景文本', () => {
    const script = `场景1:
描述: 教室里面，老师在讲课
对白: 同学们好

场景2:
描述: 操场上面，学生在跑步
对白: 加油`;

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(2);
    expect(frames[0].scene_number).toBe(1);
    expect(frames[1].scene_number).toBe(2);
  });

  it('支持 Scene 英文标记', () => {
    const script = `Scene 1:
description: A girl standing by the window
dialogue: Hello

Scene 2:
description: A boy walking down the street`;

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(2);
    expect(frames[0].scene_number).toBe(1);
  });

  it('无场景标记时视为单场景', () => {
    const script = '这是一段简单的场景描述，没有任何标记。';

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(1);
    expect(frames[0].scene_number).toBe(1);
    expect(frames[0].description.length).toBeGreaterThan(0);
  });

  it('提取各种字段：地点、时间、视觉关键词', () => {
    const script = `场景1:
地点: 咖啡馆
时间: 晚上
描述: 昏暗的咖啡馆里，烛光摇曳
视觉关键词: candlelight, warm atmosphere, cozy`;

    const frames = parseScriptToStoryboards(script);
    expect(frames[0].location).toBe('咖啡馆');
    expect(frames[0].time_of_day).toBe('晚上');
    expect(frames[0].visual_keywords).toContain('candlelight');
  });

  it('空字符串返回单个空场景', () => {
    const frames = parseScriptToStoryboards('');
    expect(Array.isArray(frames)).toBe(true);
  });

  it('默认值正确填充', () => {
    const script = '简单描述';

    const frames = parseScriptToStoryboards(script);
    expect(frames[0].time_of_day).toBe('afternoon');
    expect(frames[0].camera_angle).toBeTruthy();
    expect(frames[0].emotion).toBeTruthy();
    expect(Array.isArray(frames[0].characters_in_scene)).toBe(true);
  });
});

describe('script-parser - JSON 格式解析', () => {
  it('解析标准 JSON 格式（acts 结构）', () => {
    const script = JSON.stringify({
      title: '测试剧本',
      logline: '一个测试故事',
      acts: [
        {
          act_num: 1,
          name: '第一幕',
          scenes: [
            {
              scene_number: 1,
              title: '开场',
              location: '学校',
              time_of_day: 'morning',
              description: '学生们走进教室',
              camera_angle: 'wide_establishing',
              emotion: 'cheerful',
              dialogue: '早上好！',
              characters_in_scene: ['小明', '小红'],
            },
            {
              scene_number: 2,
              title: '冲突',
              location: '教室',
              time_of_day: 'afternoon',
              description: '老师在讲课',
              camera_angle: 'medium_shot',
              emotion: 'tense',
              characters_in_scene: ['老师', '小明'],
            },
          ],
        },
      ],
    });

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(2);
    expect(frames[0].scene_number).toBe(1);
    expect(frames[0].title).toBe('开场');
    expect(frames[0].location).toBe('学校');
    expect(frames[0].act_num).toBe(1);
    expect(frames[0].characters_in_scene).toContain('小明');
    expect(frames[0].dialogue).toBe('早上好！');
  });

  it('解析扁平 JSON 格式（scenes 结构）', () => {
    const script = JSON.stringify({
      scenes: [
        { scene_number: 3, title: '第三场', description: '场景三' },
        { scene_number: 1, title: '第一场', description: '场景一' },
        { scene_number: 2, title: '第二场', description: '场景二' },
      ],
    });

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(3);
    expect(frames[0].scene_number).toBe(1);
    expect(frames[1].scene_number).toBe(2);
    expect(frames[2].scene_number).toBe(3);
  });

  it('从 markdown 代码块中提取 JSON', () => {
    const script = `这是一些说明文字

\`\`\`json
{
  "scenes": [
    { "scene_number": 1, "description": "测试场景" }
  ]
}
\`\`\`

更多文字`;

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(1);
    expect(frames[0].scene_number).toBe(1);
    expect(frames[0].description).toBe('测试场景');
  });

  it('从 ``` 无 json 标签的代码块中提取', () => {
    const script = `\`\`\`
{
  "scenes": [
    { "scene_number": 1, "description": "测试" }
  ]
}
\`\`\``;

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(1);
  });

  it('从包含花括号的文本中提取 JSON', () => {
    const script = `一些前置文本 { "scenes": [{ "scene_number": 1, "description": "内嵌" }] } 一些后置文本`;

    const frames = parseScriptToStoryboards(script);
    expect(frames.length).toBe(1);
    expect(frames[0].description).toBe('内嵌');
  });

  it('JSON 场景包含新字段（lighting/composition/color_palette/camera_movement）', () => {
    const script = JSON.stringify({
      scenes: [
        {
          scene_number: 1,
          description: '测试',
          lighting: 'golden_hour',
          composition: 'rule_of_thirds',
          color_palette: 'warm_amber',
          camera_movement: 'push_in',
        },
      ],
    });

    const frames = parseScriptToStoryboards(script);
    expect(frames[0].lighting).toBe('golden_hour');
    expect(frames[0].composition).toBe('rule_of_thirds');
    expect(frames[0].color_palette).toBe('warm_amber');
    expect(frames[0].camera_movement).toBe('push_in');
  });

  it('默认值填充（JSON 格式）', () => {
    const script = JSON.stringify({
      scenes: [
        { scene_number: 1, description: '只有描述' },
      ],
    });

    const frames = parseScriptToStoryboards(script);
    expect(frames[0].time_of_day).toBe('afternoon');
    expect(frames[0].title).toBeTruthy();
    expect(Array.isArray(frames[0].characters_in_scene)).toBe(true);
  });

  it('空 JSON 返回空数组，回退到文本解析', () => {
    const script = JSON.stringify({});
    const frames = parseScriptToStoryboards(script);
    expect(Array.isArray(frames)).toBe(true);
  });
});

describe('script-parser - getScriptMetadata', () => {
  it('返回正确的元信息（JSON 格式）', () => {
    const script = JSON.stringify({
      title: '我的故事',
      logline: '一个关于勇气的故事',
      acts: [
        {
          act_num: 1,
          name: '第一幕',
          scenes: [
            { scene_number: 1, characters_in_scene: ['小明', '小红'] },
            { scene_number: 2, characters_in_scene: ['小明', '老师'] },
          ],
        },
      ],
    });

    const meta = getScriptMetadata(script);
    expect(meta.title).toBe('我的故事');
    expect(meta.logline).toBe('一个关于勇气的故事');
    expect(meta.sceneCount).toBe(2);
    expect(meta.characterCount).toBe(3);
  });

  it('文本格式也返回元信息', () => {
    const script = `场景1:
描述: 场景一

场景2:
描述: 场景二`;

    const meta = getScriptMetadata(script);
    expect(meta.sceneCount).toBe(2);
    expect(meta.title).toBe('漫剧剧本');
    expect(meta.characterCount).toBe(0);
  });
});
