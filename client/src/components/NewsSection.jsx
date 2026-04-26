import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

const NewsSection = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mocking news fetch - replace with real API call (e.g. NewsAPI or Finnhub)
  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fcointelegraph.com%2Frss');
        const data = await response.json();
        
        if (data.status === 'ok' && data.items) {
          const formattedNews = data.items.slice(0, 4).map((item, index) => {
            const pubDate = new Date(item.pubDate);
            const now = new Date();
            const diffMs = now - pubDate;
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            
            let timeStr = '';
            if (diffHrs > 24) {
              timeStr = `${Math.floor(diffHrs / 24)} days ago`;
            } else if (diffHrs > 0) {
              timeStr = `${diffHrs} hours ago`;
            } else {
              timeStr = 'Just now';
            }

            return {
              id: index,
              title: item.title,
              source: 'Cointelegraph',
              time: timeStr,
              url: item.link
            };
          });
          setNews(formattedNews);
        } else {
          throw new Error('Failed to fetch real news');
        }
      } catch (error) {
        console.error('Error fetching real news, falling back to mock:', error);
        // Fallback mock data
        setNews([
          {
            id: 1,
            title: "Federal Reserve signals potential rate cuts later this year",
            source: "Bloomberg",
            time: "2 hours ago",
            url: "#"
          },
          {
            id: 2,
            title: "Euro strengthens against Dollar amidst unexpected ECB remarks",
            source: "Reuters",
            time: "4 hours ago",
            url: "#"
          },
          {
            id: 3,
            title: "Yen hits 30-year low, prompting BOJ intervention fears",
            source: "Financial Times",
            time: "6 hours ago",
            url: "#"
          },
          {
            id: 4,
            title: "Global markets rally as tech stocks rebound strongly",
            source: "Wall Street Journal",
            time: "8 hours ago",
            url: "#"
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-slate-700 w-1/3 rounded mb-6"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="border-b border-slate-700/50 pb-4 mb-4">
            <div className="h-5 bg-slate-700 w-3/4 rounded mb-2"></div>
            <div className="h-4 bg-slate-700 w-1/4 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-xl font-bold text-white mb-6">Market News</h3>
      <div className="space-y-4">
        {news.map(item => (
          <a 
            key={item.id} 
            href={item.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block border-b border-slate-700/50 pb-4 last:border-0 last:pb-0 group hover:bg-slate-800/30 p-2 -mx-2 rounded transition-colors"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <h4 className="text-slate-200 group-hover:text-fintech-primary transition-colors font-medium mb-1">
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{item.source}</span>
                  <span>•</span>
                  <span>{item.time}</span>
                </div>
              </div>
              <ExternalLink size={16} className="text-slate-500 group-hover:text-fintech-primary flex-shrink-0 mt-1" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default NewsSection;
