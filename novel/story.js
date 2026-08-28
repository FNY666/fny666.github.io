// ===== 星海彼岸 — 故事脚本 =====
// 三个角色，三种结局，好感度系统

var STORY = {

// ===== 角色定义 =====
characters: {
  luna: {
    name: '晓月',
    color: '#7ec8ff',
    hair: '#e0d0ff',
    hairStyle: 'long',
    dress: 'linear-gradient(135deg, #6a9ed8, #3a6aae)',
    initial: '月',
    eyes: '#4a7ab0'
  },
  kai: {
    name: '海', 
    color: '#ffb074',
    hair: '#c8a880',
    hairStyle: 'spiky',
    dress: 'linear-gradient(135deg, #d4a06a, #a07840)',
    initial: '海',
    eyes: '#8a6a40'
  },
  iris: {
    name: '小晴',
    color: '#b0e0a0',
    hair: '#a0d0a0',
    hairStyle: 'short',
    dress: 'linear-gradient(135deg, #7ac07a, #4a8a4a)',
    initial: '晴',
    eyes: '#5a9a5a'
  }
},

// ===== 场景定义 =====
scenes: {
  bg: {
    // 使用 CSS 渐变替代背景图
    station: 'linear-gradient(135deg, #1a2a4a, #2a4060)',
    street: 'linear-gradient(135deg, #2a3a4a, #4a5a6a)',
    cafe: 'linear-gradient(135deg, #3a2a20, #5a4a30)',
    park: 'linear-gradient(135deg, #1a3a2a, #3a5a3a)',
    beach: 'linear-gradient(135deg, #1a3a5a, #3a6a8a)',
    library: 'linear-gradient(135deg, #2a2a3a, #4a3a3a)',
    rooftop: 'linear-gradient(135deg, #1a1a2a, #3a2a4a)',
    star: 'linear-gradient(180deg, #0a0a2a, #1a0a3a, #0a0a1a)',
    sunset: 'linear-gradient(135deg, #4a2a1a, #8a4a2a)',
    night: 'linear-gradient(180deg, #0a0a1a, #1a1a3a, #0a0a1a)',
    starry: 'linear-gradient(180deg, #0a0a2a, #1a0a3a, #0a0a1a)',
    dark: 'linear-gradient(180deg, #0a0a0a, #1a0a0a)',
    home: 'linear-gradient(135deg, #2a1a2a, #4a2a4a)',
  }
},

// ===== 节点定义 =====
nodes: {

  // ---------- 开篇 ----------
  opening: {
    bg: 'station',
    text: '列车到站，我提着行李箱走下车厢。\n海风裹着淡淡的咸味扑面而来——这就是星海镇，外公留下的老屋所在的地方。',
    next: 'opening2'
  },
  opening2: {
    bg: 'station',
    text: '站台上人不多，我正翻看手机地图，忽然有人拍了拍我的肩膀。',
    next: 'meet_luna'
  },

  meet_luna: {
    bg: 'station',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「你是⋯⋯林远的孙子吧？」',
    next: 'met_luna_react'
  },

  met_luna_react: {
    bg: 'station',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「我是晓月，住你外公隔壁。外公走之前跟我说过你会来，我猜就是这个时间。」',
    next: 'luna_offer'
  },

  luna_offer: {
    bg: 'station',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「要不要我带你过去？老屋有好一阵子没人住了，可能需要收拾一下。」',
    choices: [
      { text: '「好啊，麻烦你了。」', next: 'go_with_luna', effect: { luna: +2 } },
      { text: '「谢谢，我自己找过去就行。」', next: 'go_alone_street', effect: { luna: +1 } }
    ]
  },

  go_with_luna: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她提起一个箱子帮我拿，我连忙说不用。她笑了笑：「别客气，我第一次来这个镇的时候，也是有人这样帮我的。」',
    next: 'luna_chat'
  },
  luna_chat: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她在这条街上走了十年，知道每一家店的故事。街角面包店的老爷爷会在每天下午四点给流浪猫留一碟牛奶，巷子深处的画室里住着一个从不办展的画家。',
    next: 'luna_chat2'
  },
  luna_chat2: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「⋯⋯所以，」她停下脚步，回头看我，「你打算在这里待多久？」',
    next: 'luna_question'
  },
  luna_question: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她的眼睛很安静，像一面没有风的湖。',
    choices: [
      { text: '「还不知道，也许⋯⋯很久。」', next: 'luna_route_1', effect: { luna: +3 } },
      { text: '「处理完外公的事就回去。」', next: 'luna_route_2', effect: { luna: -1 } }
    ]
  },

  go_alone_street: {
    bg: 'street',
    text: '我沿着街道往前走，手里攥着外公留下的地址。镇上的人不多，偶尔有人经过，投来好奇的目光。',
    next: 'street_encounter'
  },
  street_encounter: {
    bg: 'street',
    text: '走到一个岔路口，我正犹豫该往哪边走，忽然听到身后传来一个声音。',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「嘿，迷路了？」',
    choices: [
      { text: '「有点⋯⋯请问老街怎么走？」', next: 'kai_help', effect: { kai: +2 } },
      { text: '「不用，我自己找。」', next: 'street_continue', effect: { kai: 0 } }
    ]
  },

  kai_help: {
    bg: 'street',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他咧嘴一笑，露出整齐的白牙：「巧了，我就住那条街。跟我来吧。」',
    next: 'kai_walk'
  },
  kai_walk: {
    bg: 'street',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他看起来比我大几岁，背着一个帆布包，走路带风。他告诉我他在镇上的码头工作，下午休班。',
    next: 'kai_walk2'
  },
  kai_walk2: {
    bg: 'street',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「你是林远先生的孙子？哦，他常来码头钓鱼。老爷子人很好，走之前还把他那根老鱼竿送我了。」',
    next: 'kai_question'
  },
  kai_question: {
    bg: 'street',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「既然来了星海镇，要不要去看看海？我开船带你去转转。」',
    choices: [
      { text: '「好啊，我一直很想看看这片海。」', next: 'kai_route_1', effect: { kai: +3 } },
      { text: '「改天吧，今天想先安顿下来。」', next: 'kai_route_2', effect: { kai: +1 } }
    ]
  },

  street_continue: {
    bg: 'street',
    text: '我继续往前走，终于找到了老屋。铁门上锈迹斑斑，院子里长满了杂草。',
    next: 'arrive_home'
  },

  // ---------- 到达老屋（公共节点） ----------
  arrive_home: {
    bg: 'home',
    text: '推开老屋的门，一股陈旧的木头味扑面而来。外公的书架还立在墙边，桌上放着一盏老式台灯，和一本翻到一半的书。',
    next: 'explore_home'
  },
  explore_home: {
    bg: 'home',
    text: '我走到书架前，发现外公的书里夹着不少便签。有些是读书笔记，有些是随手画的素描，还有一张星海镇的地图，上面标了几个红圈。',
    next: 'notebook'
  },
  notebook: {
    bg: 'home',
    text: '桌子的抽屉里有一个笔记本，打开第一页，是外公的字迹：\n「星海镇最美的不是海，而是那些愿意陪你一起看海的人。」',
    next: 'day1_end'
  },
  day1_end: {
    bg: 'home',
    text: '第一天就这样过去了。这是一个安静的开始，但我知道，这个小镇还有更多故事等着我去发现。',
    next: 'next_day'
  },

  // ---------- 第二天 ----------
  next_day: {
    bg: 'cafe',
    text: '第二天早上，我出门去镇上的小咖啡馆吃早餐。',
    next: 'cafe_iris'
  },
  cafe_iris: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「你是新来的吧？我请你喝杯咖啡。」',
    next: 'iris_intro'
  },
  iris_intro: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '她叫小晴，在咖啡馆做兼职。她笑起来眼睛弯弯的，说起话来语速很快，像一只精力充沛的小鸟。',
    next: 'iris_talk'
  },
  iris_talk: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「你知道吗？镇上有个传说——在星海镇最北边的悬崖上，能看到一整片发光的海。夏天的夜晚，海面会像星星一样亮起来。」',
    choices: [
      { text: '「听起来好美，你带我去看吧？」', next: 'iris_route_1', effect: { iris: +3 } },
      { text: '「传说而已，说不定是渔船灯光。」', next: 'iris_route_2', effect: { iris: -1 } }
    ]
  },

  // ========== 分支路线 ==========

  // ---- 晓月线 ----
  luna_route_1: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她微微一愣，然后笑了。那笑容很淡，却不知为什么让我觉得温暖。',
    effect: { luna: +1 },
    next: 'luna_park'
  },
  luna_park: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她带我穿过老屋后面的小巷，来到一个被遗忘的小公园。秋千架吱呀作响，长椅上的漆已经斑驳。',
    next: 'luna_park2'
  },
  luna_park2: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「我小时候常来这里，」她说，「那时候总觉得这个小镇太小了，小到容不下一个梦想。可是后来我发现，小镇只是表面小。」',
    next: 'luna_park3'
  },
  luna_park3: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「你外公也这么说过。他说，海很大，但真正重要的不是海的大小，而是你愿意和谁一起看。」',
    next: 'luna_route_choice'
  },
  luna_route_2: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她点点头，没有多说什么。但我注意到她的眼神暗了一瞬，像乌云掠过月亮。',
    next: 'luna_route_2_cont'
  },
  luna_route_2_cont: {
    bg: 'street',
    text: '她把我送到老屋门口，指了附近几家店的位置，就转身离开了。\n我看着她的背影，总觉得有什么话还没说完。',
    next: 'luna_route_rejoin'
  },
  luna_route_rejoin: {
    bg: 'home',
    text: '接下来的几天，我偶尔会碰见她。她总是礼貌地点头微笑，但那层客气像一道透明的墙。',
    next: 'luna_rejoin_choice'
  },
  luna_rejoin_choice: {
    bg: 'home',
    text: '有一天傍晚，我看到她一个人坐在公园的长椅上，看着远处的天空。',
    choices: [
      { text: '走过去，在她身边坐下。', next: 'luna_route_1', effect: { luna: +3 } },
      { text: '远远地看着，然后转身离开。', next: 'luna_ending_bad', effect: { luna: -2 } }
    ]
  },

  luna_route_choice: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她站起来，看着我：「天快黑了，我该回去了。你呢？」',
    choices: [
      { text: '「我送你吧。」', next: 'luna_route_mid1', effect: { luna: +2 } },
      { text: '「我再坐一会儿。」', next: 'luna_route_mid2', effect: { luna: 0 } }
    ]
  },
  luna_route_mid1: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '我们并肩走在暮色中。路灯一盏接一盏地亮起来，把影子拉得很长很长。',
    next: 'luna_route_mid1b'
  },
  luna_route_mid1b: {
    bg: 'street',
    char: { left: 'luna' },
    speaker: 'luna',
    text: "「你知道吗，」她轻声说，「外公走的那天，我也在。他最后一句话是：『告诉那孩子，星海镇永远是他的家。』」",
    next: 'luna_ending_good'
  },
  luna_route_mid2: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她点点头，走了几步，又回头看了我一眼。那一眼里有很多东西，但我没有追上去。',
    next: 'luna_ending_neutral'
  },

  // ---- 海线 ----
  kai_route_1: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他拍了拍我的肩膀：「那就现在吧。走，趁涨潮前去。」',
    effect: { kai: +1 },
    next: 'kai_boat'
  },
  kai_boat: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他的船不大，但保养得很好。蓝色的船身上写着「星海号」三个字，漆已经有些褪色。',
    next: 'kai_boat2'
  },
  kai_boat2: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '马达轰鸣，船头劈开海浪，飞溅的水花在阳光下闪着光。海风把头发吹得乱七八糟，我忍不住大笑起来。',
    next: 'kai_sea'
  },
  kai_sea: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他把船停在一个小海湾，指着远处说：「那边是夕阳下去的方向。每天傍晚，我都喜欢开到这儿来看。」',
    next: 'kai_sea2'
  },
  kai_sea2: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「你外公也来过。他总说，人这一辈子就像海上的船，有时候风平浪静，有时候风高浪急，但最重要的是——」',
    next: 'kai_sea3'
  },
  kai_sea3: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「——别忘记你为什么出海。」',
    next: 'kai_route_choice'
  },
  kai_route_2: {
    bg: 'street',
    text: '到了老屋，我收拾了一下午。傍晚的时候，有人敲门。',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「喏，晚饭。我多买了一份。」他递过来一个饭盒，里面是热腾腾的炒饭。',
    next: 'kai_route_2b'
  },
  kai_route_2b: {
    bg: 'home',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「明天码头有新鲜鱼上岸，要不要来看看？」',
    choices: [
      { text: '「好啊，我一定去。」', next: 'kai_route_1', effect: { kai: +3 } },
      { text: '「看情况吧。」', next: 'kai_route_2c', effect: { kai: 0 } }
    ]
  },
  kai_route_2c: {
    bg: 'home',
    text: '他走了之后，我看着那盒炒饭发了很久的呆。外公的房间还保持着原来的样子，墙上挂着一幅星海镇的水彩画。',
    next: 'kai_route_2d'
  },
  kai_route_2d: {
    bg: 'home',
    text: '画的一角用铅笔写着：「给每一个正在寻找家的人。」',
    next: 'kai_route_rejoin'
  },
  kai_route_rejoin: {
    bg: 'home',
    text: '接下来的日子，我时常去码头。海总是很忙，但每次看到我，都会扬手打招呼。',
    next: 'kai_route_choice'
  },

  kai_route_choice: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他靠在船舷上，看着渐渐变成橙红色的天空：「你觉得⋯⋯一个人可以同时属于两个地方吗？」',
    choices: [
      { text: '「可以。只要心里装得下。」', next: 'kai_ending_good', effect: { kai: +2 } },
      { text: '「我觉得不行，人只能在一个地方扎根。」', next: 'kai_ending_neutral', effect: { kai: -1 } }
    ]
  },

  // ---- 小晴线 ----
  iris_route_1: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '她的眼睛一下子亮了起来：「真的？太好了！我下班后去接你，晚上八点！」',
    effect: { iris: +1 },
    next: 'iris_night'
  },
  iris_night: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '晚上八点，她准时出现在老屋门口，背着一个大背包，里面装着毯子和热饮。',
    next: 'iris_night2'
  },
  iris_night2: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '我们沿着山路走了将近一个小时。她一路都在说话——讲她小时候爬树摔下来，讲她养过一只三条腿的猫，讲她为什么喜欢星海镇。',
    next: 'iris_cliff'
  },
  iris_cliff: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '到达悬崖的时候，我累得只想坐下。她铺好毯子，递给我一杯热可可。',
    next: 'iris_cliff2'
  },
  iris_cliff2: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '然后她关掉了手电筒。\n\n一瞬间，整个世界都安静了。',
    next: 'iris_cliff3'
  },
  iris_cliff3: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '海面上泛着细碎的荧光，像是天上的星星落进了水里。一波一波的浪涌把光推向岸边，又带回去。\n\n「你看，」她轻声说，「我没有骗你吧。」',
    next: 'iris_route_choice'
  },
  iris_route_2: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「也许吧，」她笑了笑，但笑容有点勉强，「不过我还是觉得，有些东西，只有你愿意相信的时候，它才会是真的。」',
    next: 'iris_route_2b'
  },
  iris_route_2b: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '她转身去给别的客人送咖啡了。我坐在窗边，看着外面灰蒙蒙的天，忽然觉得有点后悔。',
    next: 'iris_route_2c'
  },
  iris_route_2c: {
    bg: 'cafe',
    text: '接下来的几天，我每天都会去那家咖啡馆。她还是会对我笑，但那笑容里少了一点什么——就像一幅画失去了某种颜色。',
    next: 'iris_route_rejoin'
  },
  iris_route_rejoin: {
    bg: 'cafe',
    text: '直到有一天，咖啡馆里放了一首很好听的歌，我忍不住问了她。',
    next: 'iris_rejoin_choice'
  },
  iris_rejoin_choice: {
    bg: 'cafe',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「这首歌叫《星海》，是我自己写的。」',
    choices: [
      { text: '「你还会写歌？好厉害，能再弹一遍吗？」', next: 'iris_route_1', effect: { iris: +3 } },
      { text: '「哦，挺好听的。」', next: 'iris_ending_neutral', effect: { iris: 0 } }
    ]
  },
  iris_route_choice: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '她侧过头看我，眼睛里映着星光和海光：「你觉得⋯⋯星海镇最美的风景是什么？」',
    choices: [
      { text: '「大概是眼前这片发光的海吧。」', next: 'iris_ending_good', effect: { iris: +2 } },
      { text: '「是遇到你。」', next: 'iris_ending_best', effect: { iris: +5 } }
    ]
  },

  // ========== 结局 ==========

  // 晓月 — 好结局
  luna_ending_good: {
    bg: 'sunset',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她停下脚步，转过来面对我。夕阳把她的轮廓镀上了一层金边。',
    next: 'luna_ending_good2'
  },
  luna_ending_good2: {
    bg: 'sunset',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「你打算在这里待多久？」她问。\n\n和第一天一样的问题，但这一次，我知道答案了。',
    next: 'luna_ending_good3'
  },
  luna_ending_good3: {
    bg: 'sunset',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '「很久。也许⋯⋯不走了。」',
    next: 'luna_ending_good4'
  },
  luna_ending_good4: {
    bg: 'sunset',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '她低下头，把脸藏在垂落的发丝里。但我看到她的嘴角弯了起来，像初升的月牙。',
    next: 'luna_ending_good5'
  },
  luna_ending_good5: {
    bg: 'sunset',
    text: '那天晚上，我们坐在公园的长椅上聊了很久很久。\n\n星海镇的夜晚很安静，安静到你能听见星星在说话。',
    ending: {
      id: 'luna_good',
      title: '结局：月下归人',
      desc: '你选择了留在星海镇。\n晓月依然住在隔壁，每天早晨你们会在街角的面包店偶遇。\n有时候你会想，外公说的"最美的不是海"，大概就是这个意思。'
    }
  },

  // 晓月 — 普通结局
  luna_ending_neutral: {
    bg: 'park',
    char: { left: 'luna' },
    speaker: 'luna',
    text: '第二天，我给她发了一条消息：「谢谢你这几天的照顾。」\n\n她回了一个笑脸。',
    next: 'luna_ending_neutral2'
  },
  luna_ending_neutral2: {
    bg: 'park',
    text: '后来我偶尔会想起那个傍晚，她站在路灯下回头的眼神。\n\n但有些东西，错过了就是错过了。',
    ending: {
      id: 'luna_neutral',
      title: '结局：擦肩',
      desc: '你离开了星海镇，回到了原来的城市。\n偶尔翻开笔记本，看到外公写的那句话，你会停顿很久。\n你不知道她在公园的长椅上等了你多久。'
    }
  },

  // 晓月 — 坏结局
  luna_ending_bad: {
    bg: 'dark',
    text: '我转身离开了公园。\n\n身后似乎有什么声音，但我没有回头。',
    next: 'luna_ending_bad2'
  },
  luna_ending_bad2: {
    bg: 'dark',
    text: '几天后，我收拾好行李，准备离开星海镇。\n\n在车站等车的时候，我看到了一个熟悉的身影——她站在站台另一头，似乎在等什么人。',
    next: 'luna_ending_bad3'
  },
  luna_ending_bad3: {
    bg: 'dark',
    text: '车来了，我上了车。\n\n汽笛声响起的时候，她回过头来，看到了车窗里的我。\n\n她张了张嘴，但车已经开动了。',
    ending: {
      id: 'luna_bad',
      title: '结局：未寄出的信',
      desc: '你选择了离开，没有回头。\n后来你从外公的笔记本里翻出一张照片——\n照片上，外公和一个小女孩站在老屋门前，女孩笑得像五月的阳光。\n照片背面写着：「晓月，六岁。」'
    }
  },

  // 海 — 好结局
  kai_ending_good: {
    bg: 'sunset',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他沉默了一会儿，然后笑了。那是一种如释重负的笑。',
    next: 'kai_ending_good2'
  },
  kai_ending_good2: {
    bg: 'sunset',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「你知道吗，我在这条船上工作了七年。七年来，我一直在想一个问题——我到底属于这片海，还是属于岸上。」',
    next: 'kai_ending_good3'
  },
  kai_ending_good3: {
    bg: 'sunset',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '「今天你给了我答案。」',
    next: 'kai_ending_good4'
  },
  kai_ending_good4: {
    bg: 'sunset',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '夕阳终于沉入海面，天空变成了深紫色。\n\n他发动马达，调转船头：「走吧，我请你到镇上最好的大排档吃饭。」',
    ending: {
      id: 'kai_good',
      title: '结局：海与岸',
      desc: '你没有离开星海镇。\n你和海成了朋友，周末常常跟他出海。\n你学会了看潮汐、补渔网，还学会了在风浪来临时稳住船舵。\n你终于明白，家不是一个地方，而是一种选择。'
    }
  },

  // 海 — 普通结局
  kai_ending_neutral: {
    bg: 'beach',
    char: { right: 'kai' },
    speaker: 'kai',
    text: '他点了点头，没有反驳。只是轻轻说了一句：「也许你是对的。」',
    next: 'kai_ending_neutral2'
  },
  kai_ending_neutral2: {
    bg: 'beach',
    text: '回程的路上，他比来时沉默了很多。\n\n海浪拍打着船底，发出空洞的声响。',
    ending: {
      id: 'kai_neutral',
      title: '结局：不同的航向',
      desc: '你离开了星海镇，回到城市的格子间里继续生活。\n偶尔在加班到深夜的时候，你会想起那艘叫「星海号」的船，\n和那个问你"人能不能同时属于两个地方"的声音。'
    }
  },

  // 小晴 — 好结局
  iris_ending_good: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '她笑了，笑得像一只偷到了鱼干的猫。',
    next: 'iris_ending_good2'
  },
  iris_ending_good2: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「你知道吗，你是第一个真的来看这片海的人。镇上的人都说这是传说，没有人愿意在晚上爬四十分钟的山路。」',
    next: 'iris_ending_good3'
  },
  iris_ending_good3: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「所以⋯⋯谢谢你愿意相信。」',
    ending: {
      id: 'iris_good',
      title: '结局：星海',
      desc: '你留在了星海镇，和那个相信传说的人一起。\n小晴后来在那片悬崖上开了一家小小的露天咖啡馆，\n卖她自创的"星海特调"——一种会在杯底发出微光的饮料。\n偶尔有人问起秘诀，她只是笑而不答。'
    }
  },

  // 小晴 — 最佳结局
  iris_ending_best: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '她愣住了。\n\n海风停了，浪声远了，整个世界只剩下我们两个人。',
    next: 'iris_ending_best2'
  },
  iris_ending_best2: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '然后她笑了，笑得眼睛里有星星。',
    next: 'iris_ending_best3'
  },
  iris_ending_best3: {
    bg: 'star',
    char: { center: 'iris' },
    speaker: 'iris',
    text: '「你⋯⋯你知道我为什么叫小晴吗？」\n\n「因为出生那天是晴天？」\n\n「不，」她摇摇头，笑得更加灿烂，「因为我希望我的存在，能让别人的天空放晴。」',
    ending: {
      id: 'iris_best',
      title: '结局：晴空万里',
      desc: '半年后，咖啡馆的菜单上多了一款甜品，叫「星海彼岸」。\n旁边的小字写着：献给那个愿意陪我一起做梦的人。\n\n你坐在靠窗的位置，看着外面阳光正好，心想——\n原来，最好的故事，是你自己选择成为它的主角。'
    }
  },

  // 小晴 — 普通结局
  iris_ending_neutral: {
    bg: 'cafe',
    text: '后来我再也没有听到那首歌。\n\n小晴还是会在咖啡馆里忙碌，见到我的时候还是笑着打招呼。\n但我们之间，好像隔了一层轻纱，透明，却无法穿透。',
    ending: {
      id: 'iris_neutral',
      title: '结局：未完成的旋律',
      desc: '你离开了星海镇，带走了一首没听完的歌。\n偶尔在深夜搜索记忆，你会想起那个背着大背包的女孩，\n和她说"有些东西只有你相信才是真的"时的表情。'
    }
  },

  // ========== 隐藏结局 ==========
  hidden_ending: {
    bg: 'starry',
    text: '⋯⋯等等。\n\n你感觉有人在你身后。',
    next: 'hidden_ending2'
  },
  hidden_ending2: {
    bg: 'starry',
    text: '你转过身。\n\n没有人在那里。\n\n但风里有一个声音，像是从很远的地方传来的：',
    next: 'hidden_ending3'
  },
  hidden_ending3: {
    bg: 'starry',
    text: '「谢谢你来看我。」',
    next: 'hidden_ending4'
  },
  hidden_ending4: {
    bg: 'starry',
    text: '那是外公的声音。',
    ending: {
      id: 'hidden',
      title: '隐藏结局：星海彼岸',
      desc: '有些告别不需要说出口。\n有些人的存在，就像星海镇的荧光海——\n你不需要一直看着它，\n只要知道它在那里，就够了。'
    }
  }
}
}; // end STORY