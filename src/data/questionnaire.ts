import type { QuestionnaireQuestion } from '@/types/types';

export const questionnaireQuestions: QuestionnaireQuestion[] = [
  {
    id: 1,
    question: '你通常如何称呼自己？（如：我、本人、俺、咱等）',
    placeholder: '例如：我',
    type: 'text',
  },
  {
    id: 2,
    question: '你的性格更偏向哪一种？',
    type: 'select',
    options: ['外向活泼', '内向沉稳', '随和中庸', '严谨认真'],
  },
  {
    id: 3,
    question: '在聊天时，你更喜欢使用什么样的语气？',
    type: 'select',
    options: ['轻松幽默', '正式礼貌', '简洁直接', '温和亲切'],
  },
  {
    id: 4,
    question: '你经常使用表情符号或emoji吗？',
    type: 'select',
    options: ['经常使用，几乎每句都有', '偶尔使用', '很少使用', '从不使用'],
  },
  {
    id: 5,
    question: '描述一下你的职业或主要身份',
    placeholder: '例如：学生、程序员、设计师、自由职业者等',
    type: 'text',
  },
  {
    id: 6,
    question: '你的年龄段是？',
    type: 'select',
    options: ['18岁以下', '18-25岁', '26-35岁', '36-45岁', '45岁以上'],
  },
  {
    id: 7,
    question: '你更喜欢长句子还是短句子？',
    type: 'select',
    options: ['长句子，表达详细', '短句子，简洁明了', '看情况而定'],
  },
  {
    id: 8,
    question: '你有什么特殊的口头禅或常用词汇吗？',
    placeholder: '例如：哈哈、嗯嗯、好的、没问题等',
    type: 'textarea',
  },
  {
    id: 9,
    question: '在面对不同的人时，你的说话方式会有变化吗？',
    type: 'select',
    options: ['会，对不同人用不同方式', '基本一致', '看心情'],
  },
  {
    id: 10,
    question: '简单描述一下你的生活状态或兴趣爱好',
    placeholder: '例如：喜欢运动、热爱阅读、经常加班、享受独处等',
    type: 'textarea',
  },
];
