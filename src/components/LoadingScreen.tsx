import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  onTransitionEnd?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onTransitionEnd }) => {
  const [stage, setStage] = useState(0);
  const [showLongWait, setShowLongWait] = useState(false);

  // 阶段配置
  const stages = [
    {
      // 0-3s
      title: '理解用户',
      messages: [
        '我在认真读你刚刚说的话…',
        '有些话，说出来本身就不容易 🤍'
      ],
      duration: 3000
    },
    {
      // 3-6s
      title: '判断关系',
      messages: [
        '先理一理你们之间的关系和场景',
        '不同关系，回应方式差别很大'
      ],
      duration: 3000
    },
    {
      // 6-10s
      title: '分析对方',
      messages: [
        '试着还原对方这句话背后的真实想法',
        '有些话，不止表面那一层意思'
      ],
      duration: 4000
    },
    {
      // 10-15s
      title: '组织回应',
      messages: [
        '帮你找一个既不委屈自己、也不伤人的说法',
        '说得好，比说得快更重要'
      ],
      duration: 5000
    },
    {
      // 15s+
      title: '陪伴兜底',
      messages: [
        '马上就好，再陪我一会儿 ☕',
        '不管怎么回，你的感受都是合理的'
      ],
      duration: 15000 // 这里的duration可以长一点，直到loading结束
    }
  ];

  // 进度列表项
  const progressItems = [
    '已理解你的处境',
    '判断关系与场景',
    '分析对方的真实意图',
    '组织合适的回应方式'
  ];

  // 随机情绪兜底文案
  const emotionalFooters = [
    '不管结果如何，你的感受都值得被认真对待',
    '有些话，慢一点想反而更有力量',
    '你已经做得很好了'
  ];
  const [footerMessage] = useState(() => emotionalFooters[Math.floor(Math.random() * emotionalFooters.length)]);

  useEffect(() => {
    let currentStage = 0;
    let timeoutId: NodeJS.Timeout;

    const runStage = () => {
      if (currentStage >= stages.length) return;
      
      const duration = stages[currentStage].duration;
      timeoutId = setTimeout(() => {
        currentStage++;
        if (currentStage < stages.length) {
          setStage(currentStage);
          runStage();
        }
      }, duration);
    };

    runStage();

    // 30s超时处理
    const longWaitTimeout = setTimeout(() => {
      setShowLongWait(true);
    }, 30000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(longWaitTimeout);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-between py-12 px-6">
      {/* 顶部：轻量动态元素 */}
      <div className="w-full flex justify-center pt-8">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <div className="w-12 h-12 rounded-full bg-primary/20" />
        </motion.div>
      </div>

      {/* 中间核心内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md space-y-12">
        {/* 主文案区（阶段性轮播） */}
        <div className="h-32 flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={showLongWait ? 'long-wait' : stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-3"
            >
              {showLongWait ? (
                <>
                  <p className="text-xl font-medium text-foreground">这次分析稍微复杂一点</p>
                  <p className="text-base text-muted-foreground">我还在认真帮你想，再给我一点时间 🤍</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-medium text-foreground">
                    {stages[stage].messages[0]}
                  </p>
                  <p className="text-base text-muted-foreground">
                    {stages[stage].messages[1]}
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 进度感提示区 */}
        <div className="w-full space-y-3 pl-8">
          {progressItems.map((item, index) => {
            // 计算当前项的状态
            // stage 0 -> item 0 (active)
            // stage 1 -> item 0 (done), item 1 (active)
            let status: 'pending' | 'active' | 'done' = 'pending';
            if (index < stage) status = 'done';
            else if (index === stage) status = 'active';

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ 
                  opacity: status === 'pending' ? 0.3 : 1,
                  x: 0
                }}
                className="flex items-center gap-3 text-sm"
              >
                <div className="w-4 flex justify-center">
                  {status === 'done' && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-primary font-bold"
                    >
                      ✓
                    </motion.span>
                  )}
                  {status === 'active' && (
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-primary"
                    />
                  )}
                </div>
                <span className={status === 'active' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                  {item}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 底部：情绪兜底提示 */}
      <div className="w-full text-center pb-8">
        <p className="text-sm text-muted-foreground/80">
          {footerMessage}
        </p>
      </div>
    </div>
  );
};
