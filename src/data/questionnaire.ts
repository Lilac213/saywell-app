import type { QuestionnaireQuestion } from '@/types/types';

export const questionnaireQuestions: QuestionnaireQuestion[] = [
  {
    id: 0,
    question: '您是第一次使用本应用吗？',
    type: 'select',
    options: ['是，我是新用户', '否，我想补充或更新我的画像'],
  },
  {
    id: 1,
    question: '你的性别是？',
    type: 'select',
    options: ['男生', '女生', '其他'],
  },
  {
    id: 2,
    question: '你的星座是？',
    type: 'select',
    options: [
      '白羊座',
      '金牛座',
      '双子座',
      '巨蟹座',
      '狮子座',
      '处女座',
      '天秤座',
      '天蝎座',
      '射手座',
      '摩羯座',
      '水瓶座',
      '双鱼座',
    ],
  },
  {
    id: 3,
    question: '你的年龄段是？',
    type: 'select',
    options: ['18岁以下', '18-25岁', '26-35岁', '36-45岁', '45岁以上'],
  },
  {
    id: 4,
    question: '平时你是个怎样的人？',
    placeholder: '例如：性格开朗、喜欢开玩笑、比较内向、说话直接等',
    type: 'textarea',
  },
  {
    id: 5,
    question: '你平时发消息的习惯是？',
    type: 'select',
    options: [
      '喜欢一次发完，一条长消息',
      '习惯分成多条短消息发送',
      '看情况，有时长有时短',
    ],
  },
  {
    id: 6,
    question: '你是否要设定特别关心的人？',
    type: 'select',
    options: ['否，暂不设定', '是，我要设定'],
  },
  {
    id: 7,
    question: '请输入TA在你这里的备注名称',
    placeholder: '例如：老板、小王、妈妈、宝贝等',
    type: 'text',
    conditionalOn: 6,
    conditionalValue: '是，我要设定',
  },
  {
    id: 8,
    question: 'TA跟你的关系是？',
    placeholder: '例如：领导、同事、朋友、父母、爱人、暧昧对象、追求对象、追求者等',
    type: 'text',
    conditionalOn: 6,
    conditionalValue: '是，我要设定',
  },
];

// 老用户补充问卷（只有一个问题）
export const updateQuestions: QuestionnaireQuestion[] = [
  {
    id: 100,
    question: '请输入您想补充或更新的个人信息',
    placeholder: '例如：我最近喜欢用"hhh"表示笑，或者我现在说话更直接了等',
    type: 'textarea',
  },
];
