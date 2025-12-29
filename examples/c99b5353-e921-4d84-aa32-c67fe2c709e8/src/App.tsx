import React, { useState, useRef, useEffect } from 'react';
import { Book, Sparkles, Moon, Stars, Wand2 } from 'lucide-react';

const answers = [
  "是的",
  "不是",
  "也许吧",
  "当然",
  "绝对不",
  "值得一试",
  "现在不是时候",
  "相信你的直觉",
  "稍后再问",
  "不要执着",
  "放手去做",
  "需要等待",
  "保持耐心",
  "很快就会明白",
  "不要犹豫",
  "顺其自然",
  "重新思考",
  "答案就在眼前",
  "不要强求",
  "一切皆有可能"
];

const mysticalSymbols = ['✧', '⚝', '❈', '⚯', '☆', '⚡', '✵', '⚘'];

function StarField() {
  const [stars, setStars] = useState<Array<{ top: number; left: number; size: number; duration: number; opacity: number }>>([]);

  useEffect(() => {
    const newStars = Array.from({ length: 50 }, () => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 3 + 2,
      opacity: Math.random() * 0.5 + 0.2
    }));
    setStars(newStars);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {stars.map((star, i) => (
        <div
          key={i}
          className="star"
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            '--duration': `${star.duration}s`,
            '--opacity': star.opacity
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function App() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    const newSymbols = Array.from({ length: 6 }, () => 
      mysticalSymbols[Math.floor(Math.random() * mysticalSymbols.length)]
    );
    setSymbols(newSymbols);
  }, [answer]);

  const getAnswer = () => {
    if (!question.trim()) return;
    
    setIsAnswering(true);
    setIsShaking(true);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
      setAnswer(randomAnswer);
      setIsShaking(false);
      setIsAnswering(false);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    getAnswer();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 flex items-center justify-center p-4 relative overflow-hidden">
      <StarField />
      
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=2000&q=80')] opacity-10 bg-cover bg-center" />
      
      <div className="max-w-md w-full bg-black/40 backdrop-blur-xl rounded-2xl p-8 shadow-2xl mystical-border relative">
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <Moon className="w-12 h-12 text-purple-300 animate-float" />
        </div>
        
        <div className="text-center mb-8 relative">
          <div className="flex justify-center mb-4 relative">
            <Book className="w-16 h-16 text-purple-200 animate-float" />
            <Stars className="w-6 h-6 text-yellow-300 absolute -top-2 -right-2 animate-glow" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">答案之书</h1>
          <p className="text-purple-200">向宇宙寻求答案</p>
          
          <div className="absolute top-0 left-0 w-full flex justify-between px-4 opacity-50">
            {symbols.slice(0, 3).map((symbol, i) => (
              <span key={i} className="text-purple-300 animate-float" style={{animationDelay: `${i * 0.2}s`}}>
                {symbol}
              </span>
            ))}
          </div>
          
          <div className="absolute bottom-0 right-0 w-full flex justify-between px-4 opacity-50">
            {symbols.slice(3).map((symbol, i) => (
              <span key={i} className="text-purple-300 animate-float" style={{animationDelay: `${i * 0.2}s`}}>
                {symbol}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="在此输入你的问题..."
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-purple-300/30 text-white placeholder-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
              disabled={isAnswering}
            />
            <Wand2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-300" />
          </div>

          <button
            type="submit"
            disabled={!question.trim() || isAnswering}
            className={`w-full py-3 rounded-lg bg-purple-600 text-white font-semibold 
              ${!question.trim() || isAnswering ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'} 
              transition-all duration-300 flex items-center justify-center gap-2 group`}
          >
            <Sparkles className="w-5 h-5 group-hover:animate-spin" />
            寻求答案
          </button>
        </form>

        {answer && (
          <div className={`mt-8 text-center ${isShaking ? 'animate-shake' : ''}`}>
            <div className="bg-white/10 backdrop-blur rounded-lg p-6 mystical-border">
              <p className="text-xl font-medium text-white">{answer}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;