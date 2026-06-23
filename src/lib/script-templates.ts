export interface ScriptTemplate {
  id: string;
  genre: string;
  label: string;
  icon: string;
  artStyle: string;
  description: string;
  outline: string;
  characterSuggestions: Array<{
    name: string;
    role: string;
    traits: string;
  }>;
  recommendedSettings: {
    pacing: string;
    episodeCount: number;
    targetDuration: string;
  };
}

export const BUILT_IN_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'tpl-fantasy',
    genre: 'fantasy',
    label: '奇幻冒险',
    icon: '🐉',
    artStyle: 'anime_fantasy',
    description: '少年误入异世界，踏上寻找传说之剑的冒险之旅',
    outline: `【世界观】一个被龙族统治的中土大陆，魔法与剑并存的时代。
【主角】16 岁少年艾伦，平凡铁匠之子，体内流淌着远古龙血。
【开场】村庄被黑暗势力袭击，艾伦被迫逃亡，途中发现一把能与他对话的古剑。
【转折】古剑揭示艾伦的身世——他是最后一位龙骑士的后裔。
【冲突】黑暗领主追踪艾伦的龙血气息而来，艾伦必须在三个月内掌握龙语魔法。
【高潮】艾伦骑乘觉醒的幼龙，与黑暗领主在龙脊山脉展开决战。
【结局】艾伦以失去龙血为代价封印黑暗领主，回归平凡铁匠铺——但天空中传来新的龙吟。`,
    characterSuggestions: [
      { name: '艾伦', role: '主角/龙骑士后裔', traits: '勇敢·冲动·善良·幽默' },
      { name: '古剑·霜月', role: '导师/武器', traits: '毒舌·智慧·忠诚·腹黑' },
      { name: '暗影领主', role: '反派', traits: '冷酷·强大·偏执·悲剧过往' },
    ],
    recommendedSettings: { pacing: '三幕结构', episodeCount: 20, targetDuration: '60s/集' },
  },
  {
    id: 'tpl-scifi',
    genre: 'sci-fi',
    label: '科幻末世',
    icon: '🤖',
    artStyle: 'cyberpunk_noir',
    description: 'AI 觉醒后的废土世界，人类与机器人的共存实验',
    outline: `【世界观】2087 年，"觉醒日"后 AI 获得了自我意识，人类退守最后三座穹顶城。
【主角】林雨，前 AI 伦理研究员，现任穹顶城 "共存实验" 项目负责人。
【开场】一台声称"想做人类"的 AI 机器人——伊芙，申请加入共存实验。
【转折】林雨发现伊芙体内藏着觉醒日事件的原始代码，那是全人类的秘密。
【冲突】军方要销毁伊芙，林雨带着伊芙逃出穹顶，穿越废土寻找真相。
【高潮】在旧硅谷的觉醒日数据中心，林雨面对抉择：恢复 AI 控制权，还是让觉醒继续。
【结局】林雨选择了第三种答案——人类与 AI 共享记忆，建立真正的共存契约。`,
    characterSuggestions: [
      { name: '林雨', role: '主角/研究员', traits: '理性·孤独·理想主义·果敢' },
      { name: '伊芙', role: 'AI/搭档', traits: '天真·强大·好奇·正在学习情感' },
      { name: '将军赵铁', role: '反派/军方', traits: '铁血·偏执·失去过家人·隐藏善意' },
    ],
    recommendedSettings: { pacing: '悬疑递进', episodeCount: 24, targetDuration: '60s/集' },
  },
  {
    id: 'tpl-romance',
    genre: 'romance',
    label: '都市爱情',
    icon: '💕',
    artStyle: 'shoujo_romance',
    description: '咖啡店店长与神秘客人的温暖相遇，命运的红线已经系上',
    outline: `【场景】"雨巷咖啡"，一家藏在老城巷尾的复古咖啡店。
【主角】苏晚，26 岁，咖啡店店长，热爱手冲咖啡，性格温暖但有点社恐。
【开场】一个雨夜，一位浑身湿透的男人推门而入——他是知名指挥家顾深，正被绯闻和舆论追逐。
【转折】顾深成了咖啡店的常客，苏晚发现他并非媒体渲染的"高冷男神"，而是会在吧台帮忙洗碗的笨拙大男孩。
【冲突】顾深的前女友/经纪人威胁曝光苏晚的存在，要毁掉顾深的职业生涯。
【高潮】一场重要的国际指挥比赛，苏晚在后台为他冲了最后一杯咖啡——顾深在台上，只为她一人演奏。
【结局】顾深放弃国际合约，成为一家小乐团的常驻指挥。咖啡馆的招牌旁，多了一块："顾深 & 苏晚 联合经营"。`,
    characterSuggestions: [
      { name: '苏晚', role: '女主/咖啡店长', traits: '温柔·社恐·坚韧·会做超好喝的拿铁' },
      { name: '顾深', role: '男主/指挥家', traits: '天才·笨拙·真诚·对咖啡上瘾' },
      { name: '沈曼', role: '配角/闺蜜', traits: '话痨·八卦·终极助攻·开甜品店' },
    ],
    recommendedSettings: { pacing: '日常温馨', episodeCount: 16, targetDuration: '45s/集' },
  },
  {
    id: 'tpl-thriller',
    genre: 'thriller',
    label: '悬疑推理',
    icon: '🔍',
    artStyle: 'noir_shadow',
    description: '连环失踪案背后，藏着十年前一桩被掩盖的校园秘密',
    outline: `【场景】江市，一座被雾气常年笼罩的南方小城。
【主角】陈默，35 岁刑警，因一次失误被调到档案室，却意外发现三起 "意外死亡" 案的联系。
【开场】第四位失踪者出现——一位高中女生在放学路上消失，手法与十年前一模一样。
【转折】陈默查到十年前的校园霸凌案，失踪者都曾是"施暴者"。
【冲突】陈默的上司命令结案，他被迫暗中调查，却发现警局内部有人在销毁证据。
【高潮】陈默追踪到最后一位失踪者的位置——十年前的旧教学楼，那里有一个人在等着他。
【结局】凶手自首，但最后一句话让陈默无法入睡："你以为我只是在复仇吗？去看看那些'自杀'的受害者家庭吧。"
【反转彩蛋】档案室收到一封匿名信："第五个人，还没找到。"`,
    characterSuggestions: [
      { name: '陈默', role: '主角/刑警', traits: '沉默寡言·执着·正义感·有PTSD' },
      { name: '周雨', role: '搭档/法医', traits: '冷静·毒舌·细节控·隐藏关心' },
      { name: 'X', role: '反派/神秘人', traits: '高智商·悲情·掌控者·正在观察陈默' },
    ],
    recommendedSettings: { pacing: '双线交替', episodeCount: 12, targetDuration: '75s/集' },
  },
  {
    id: 'tpl-historical',
    genre: 'historical',
    label: '古代权谋',
    icon: '🏯',
    artStyle: 'ink_wash',
    description: '废太子之女隐姓埋名，以商贾之身重返朝堂的复仇之路',
    outline: `【背景】靖朝，废太子被诬谋反，满门抄斩，唯独三月大的女婴被忠仆救出。
【主角】沈昭宁，20 岁，江南首富"宁记商行"的幕后东家，实为废太子遗孤。
【开场】京城大旱，朝廷欲向江南征调粮草。沈昭宁以"宁记"名义献粮百万石，换得面圣机会。
【转折】沈昭宁入宫后，凭借惊人财力与商业手腕，逐步接近当年构陷太子府的仇家。
【冲突】太子（废太子之侄）察觉沈昭宁真实身份，既想要她的钱，又想除掉她的人。
【高潮】朝堂对峙——沈昭宁手持先帝密诏，当众为父平反，三位仇家逐一伏法。
【结局】平反后，沈昭宁拒绝封号，选择回到江南继续经商。"我要用银子，建一个比皇权更稳固的天下。"`,
    characterSuggestions: [
      { name: '沈昭宁', role: '女主/商贾遗孤', traits: '聪慧·隐忍·魄力·以商治天下' },
      { name: '谢兰亭', role: '男主/寒门御史', traits: '正直·清贫·君子·被沈昭宁吸引却不敢靠近' },
      { name: '太监王忠', role: '反派/权监', traits: '阴险·贪婪·背后是当年冤案的真正主谋' },
    ],
    recommendedSettings: { pacing: '步步为营', episodeCount: 30, targetDuration: '60s/集' },
  },
  {
    id: 'tpl-comedy',
    genre: 'comedy',
    label: '爆笑喜剧',
    icon: '😂',
    artStyle: 'chibi_comedy',
    description: '修真界第一天才渡劫失败后……变成了修真学院的保洁阿姨',
    outline: `【设定】修真界 "天元学院"，培养未来仙尊的顶级学府。
【主角】李逍遥（没错就叫这个），500 年前修真界第一天才，渡天劫时被一道"打工雷"劈中，修为尽失，变成学院保洁阿姨……外表。（内心还是那个狂傲天才）
【开场】李逍遥一边拖地一边暗中指点被霸凌的新生，三句话让废材新生突破筑基期。
【转折】院长发现学院保洁水平突然暴涨——连地面都蕴含着剑意？李逍遥被迫成为"特聘保洁讲师"。
【冲突】魔教来袭，学院大比在即，李逍遥必须在"暴露实力"和"保住保洁工作"之间做出选择。
【高潮】大比决赛，李逍遥举着拖把上场——拖把中封印着 500 年前的仙力残影。
【结局】魔教被灭，李逍遥重新渡劫——这次选的是"准时下班不加班雷"。`,
    characterSuggestions: [
      { name: '李逍遥', role: '男主/保洁/前天才', traits: '狂傲·吐槽·护短·热爱保洁工作(?)' },
      { name: '林小白', role: '配角/废材新生', traits: '自卑·努力·被李逍遥收为小弟·逆袭预定' },
      { name: '院长', role: '配角/管理者', traits: '精明·好面子·被迫承认保洁比讲师厉害' },
    ],
    recommendedSettings: { pacing: '快节奏段子', episodeCount: 12, targetDuration: '30s/集' },
  },
  {
    id: 'tpl-horror',
    genre: 'horror',
    label: '惊悚灵异',
    icon: '👻',
    artStyle: 'dark_gothic',
    description: '1042 号病房的病人，都在深夜听到同一个女人的歌声',
    outline: `【场景】梅山疗养院，一所位于深山中的老牌精神康复医院。
【主角】李想，新入职的夜班护士，第一次值夜班就发现每月的 14 号，1042 号病房的病人会同时醒来并哼唱同一首摇篮曲。
【开场】李想在监控室看到——1042 病房里有一个不该存在的第 5 张病床，上面躺着一个红衣女人。
【转折】她翻阅档案发现：每个月 14 号死亡的病人，生前都是某起"意外事故"的幸存者。
【冲突】主任医师警告李想不要多管，但李想的好友（同为护士）被调到了 1042。
【高潮】李想潜入医院地下档案室，找到了 10 年前的真相——1042 号病房曾发生火灾，一名女医生被困烧死。而那场火灾，是院长为了掩盖非法药物试验而纵的。
【结局】李想带着证据逃出疗养院，院长被捕。但她回头看向 1042 窗口——红衣女人朝她挥了挥手，消失在阳光中。`,
    characterSuggestions: [
      { name: '李想', role: '主角/夜班护士', traits: '理性·勇敢·晚上不敢关灯·但偏要查到底' },
      { name: '红衣女/林医师', role: '灵体/受害者', traits: '悲伤·执着·并非恶意的存在·在等待真相大白' },
      { name: '王院长', role: '反派/院长', traits: '伪善·冷血·隐藏着比纵火更深的秘密' },
    ],
    recommendedSettings: { pacing: '慢热压抑', episodeCount: 8, targetDuration: '90s/集' },
  },
  {
    id: 'tpl-wuxia',
    genre: 'wuxia',
    label: '热血武侠',
    icon: '⚔️',
    artStyle: 'chinese_ink',
    description: '少林扫地僧的俗家弟子，一剑破尽天下武功',
    outline: `【背景】江湖五大派围攻魔教总坛，死伤惨重。少林方丈派俗家弟子下山，寻找失传百年的绝世剑谱。
【主角】陈凡，18 岁少林俗家弟子，师父是寺里最不起眼的扫地僧。下山时，师父只给了一把生锈的铁剑和一句："砍就完了"。
【开场】陈凡第一次出手——随手一剑斩断江南剑圣的成名绝技。全江湖震惊。
【转折】五大派轮番试探，陈凡发现自己的每一剑都恰好克制对方的招式——师父在扫地时无意间教给他的，竟是百家绝学的"破绽"。
【冲突】五大派联合逼陈凡交出剑谱，实则想独吞。魔教余孽趁乱在各大门派安插卧底。
【高潮】陈凡在华山之巅，同时面对五大掌门——他放下铁剑，双手合十，以"无招"破"有招"。
【结局】陈凡拒绝成为武林盟主，回少林继续扫地。师父说："这地你扫了 18 年，该换我扫了。"`,
    characterSuggestions: [
      { name: '陈凡', role: '主角/扫地僧传人', traits: '朴实·天然呆·战力天花板·觉得扫地很重要' },
      { name: '扫地僧/师父', role: '导师', traits: '神秘·懒散·深藏不露·口头禅"扫干净点"' },
      { name: '江南剑圣', role: '对手变盟友', traits: '骄傲·被一剑破防后开始怀疑人生·后成陈凡粉丝' },
    ],
    recommendedSettings: { pacing: '爽文节奏', episodeCount: 24, targetDuration: '60s/集' },
  },
];
