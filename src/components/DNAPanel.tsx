'use client';

import { useState, useEffect } from 'react';

interface DNAPanelProps {
  characterId: string;
  projectId: string;
  initialDNA?: {
    dnaSummary?: string | null;
    dnaLocked?: boolean;
    referenceImg?: string | null;
  };
}

interface DNAAsset {
  id: string;
  type: string;
  url: string;
  label?: string;
  isPrimary: boolean;
}

export default function DNAPanel({ characterId, projectId, initialDNA }: DNAPanelProps) {
  const [dnaSummary, setDnaSummary] = useState(initialDNA?.dnaSummary || '');
  const [dnaLocked, setDnaLocked] = useState(initialDNA?.dnaLocked || false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [consistencyScore, setConsistencyScore] = useState<number | null>(null);
  const [assets, setAssets] = useState<DNAAsset[]>([]);
  const [message, setMessage] = useState('');

  // 加载 DNA 档案
  useEffect(() => {
    fetch(`/api/characters/dna/extract?characterId=${characterId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.character) {
          setDnaSummary(data.character.dnaSummary || '');
          setDnaLocked(data.character.dnaLocked || false);
        }
        if (data.assets) setAssets(data.assets);
      })
      .catch(() => {});
  }, [characterId]);

  // 提取 DNA
  const handleExtract = async () => {
    setIsExtracting(true);
    setMessage('');
    try {
      const res = await fetch('/api/characters/dna/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (data.success) {
        setDnaSummary(data.dnaSummary);
        setDnaLocked(data.dnaLocked);
        setMessage('✅ DNA 提取成功');
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage('❌ DNA 提取失败');
    } finally {
      setIsExtracting(false);
    }
  };

  // 一致性检查
  const handleCheck = async () => {
    setIsChecking(true);
    setConsistencyScore(null);
    setMessage('');
    try {
      const res = await fetch('/api/characters/dna/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      });
      const data = await res.json();
      if (data.success && data.results.length > 0) {
        const r = data.results[0];
        if (r.score !== null) {
          setConsistencyScore(r.score);
          setMessage(`✅ 一致性评分: ${r.score}/100`);
        } else {
          setMessage(`ℹ️ ${r.reason || '无法评分'}`);
        }
      } else {
        setMessage('ℹ️ 暂无数据可检查');
      }
    } catch {
      setMessage('❌ 检查失败');
    } finally {
      setIsChecking(false);
    }
  };

  const scoreColor = consistencyScore !== null
    ? consistencyScore >= 80 ? 'text-green-600'
      : consistencyScore >= 60 ? 'text-yellow-600'
      : 'text-red-600'
    : '';

  return (
    <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-white">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span>🧬</span> 角色 DNA
        </h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          dnaLocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {dnaLocked ? '已锁定' : '未锁定'}
        </span>
      </div>

      {/* DNA 摘要 */}
      <div>
        <label className="text-xs text-gray-500 font-medium mb-1 block">DNA 摘要</label>
        {dnaSummary ? (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 leading-relaxed">{dnaSummary}</p>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-400 italic">
            尚未提取 DNA
          </div>
        )}
        <button
          onClick={handleExtract}
          disabled={isExtracting}
          className="mt-2 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
        >
          {isExtracting ? '提取中...' : (dnaSummary ? '重新提取' : '提取 DNA')}
        </button>
      </div>

      {/* 参考图 */}
      {assets.length > 0 && (
        <div>
          <label className="text-xs text-gray-500 font-medium mb-2 block">参考图集</label>
          <div className="grid grid-cols-4 gap-2">
            {assets.map(asset => (
              <div key={asset.id} className="relative group">
                <img
                  src={asset.url}
                  alt={asset.label || asset.type}
                  className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                />
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 text-white text-[10px] rounded">
                  {asset.label || asset.type}
                </span>
                {asset.isPrimary && (
                  <span className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full" title="主参考图" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 一致性评分 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 font-medium">一致性评分</label>
          {consistencyScore !== null && (
            <span className={`text-lg font-bold ${scoreColor}`}>
              {consistencyScore}
            </span>
          )}
        </div>
        <button
          onClick={handleCheck}
          disabled={isChecking}
          className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 transition-colors"
        >
          {isChecking ? '检查中...' : '检查一致性'}
        </button>
      </div>

      {/* 消息 */}
      {message && (
        <div className="p-2.5 bg-blue-50 rounded-lg text-sm text-blue-700">
          {message}
        </div>
      )}
    </div>
  );
}
