import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag, Play } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { formatProductDisplayName, formatCurrency } from '../utils/productFormatters';
import { resolveMediaUrl } from '../services/api';
import './ShoppableVideos.css';

// Product images
import p1 from '../assets/1.webp';
import p2 from '../assets/2.webp';
import p3 from '../assets/3.webp';
import p4 from '../assets/6.webp';
import p5 from '../assets/5.webp';

const baseVideoData = [
  { id: 1, videoUrl: '/videos/Carrot%20Malt(JAR).mp4', productImg: p1, title: 'CARROT MALT', price: '₹249' },
  { id: 2, videoUrl: '/videos/Beetroot%20Malt(JAR).mp4', productImg: p2, title: 'BEETROOT MALT', price: '₹249' },
  { id: 3, videoUrl: '/videos/MULTANI%20MITTI.mp4', productImg: p3, title: 'MULTANI MITTI', price: '₹120' },
  { id: 4, videoUrl: '/videos/PAASI%20PAYIR.mp4', productImg: p4, title: 'PAASI PAYIR', price: '₹180' },
  { id: 5, videoUrl: '/videos/Wild%20Turmeric.mp4', productImg: p5, title: 'WILD TURMERIC', price: '₹140' }
];

function LazyVideoCard({ item, addToCart, navigate, actualProduct, index = 0 }) {
  const [hasLoaded, setHasLoaded] = useState(index < 3); // Pre-warm first 3 reels immediately
  const [videoPlaying, setVideoPlaying] = useState(false);
  const cardRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasLoaded(true);
          if (videoRef.current && videoRef.current.paused) {
            const p = videoRef.current.play();
            if (p && typeof p.then === 'function') {
              p.then(() => setVideoPlaying(true)).catch(() => {});
            }
          }
        } else {
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
        }
      },
      { threshold: 0.1, rootMargin: '250px 0px' } // Pre-load 250px before entering viewport
    );
    if (cardRef.current) observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleCardClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {});
      } else {
        videoRef.current.pause();
        setVideoPlaying(false);
      }
    }
  };

  const displayImg = (actualProduct && actualProduct.image) ? resolveMediaUrl(actualProduct.image) : item.productImg;

  return (
    <div className="sv-card ultra" ref={cardRef} onClick={handleCardClick} role="button" tabIndex={0}>
      <div className="sv-video-bg">
        {displayImg && (
          <img
            src={displayImg}
            alt={actualProduct?.name || item.title}
            className="sv-card-poster"
            loading={index < 2 ? "eager" : "lazy"}
            decoding={index < 2 ? "sync" : "async"}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: videoPlaying ? 'none' : 'brightness(0.9)',
              opacity: videoPlaying ? 0 : 1,
              transition: 'opacity 0.2s ease',
              zIndex: 0
            }}
          />
        )}
        {hasLoaded && (
          <video
            ref={videoRef}
            className="sv-iframe"
            src={item.videoUrl}
            title={item.title}
            autoPlay
            muted
            loop
            playsInline
            webkit-playsinline="true"
            preload={index < 3 ? "auto" : "metadata"}
            onPlaying={() => setVideoPlaying(true)}
            onLoadedData={() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().then(() => setVideoPlaying(true)).catch(() => {});
              }
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1
            }}
          />
        )}
      </div>

      <div className="sv-top-reel-badge">
        <span className="sv-reel-dot"></span>
        <span className="sv-reel-text">Reel</span>
      </div>

      <div className="sv-gradient-overlay"></div>

      <div className="sv-glass-panel">
        <div 
          className="sv-product-img-wrapper" 
          onClick={() => actualProduct && navigate(`/product/${actualProduct.id}`)}
          style={{ cursor: actualProduct ? 'pointer' : 'default' }}
        >
          {displayImg && (
            <img 
              src={displayImg} 
              alt={actualProduct?.name || item.title} 
              className="sv-product-img" 
              loading="lazy" 
            />
          )}
        </div>
        <div 
          className="sv-product-details"
          onClick={() => actualProduct && navigate(`/product/${actualProduct.id}`)}
          style={{ cursor: actualProduct ? 'pointer' : 'default' }}
        >
          <h4 className="sv-product-title">{formatProductDisplayName(actualProduct?.name || item.title)}</h4>
          <div className="sv-product-price">{formatCurrency(actualProduct?.price || item.price)}</div>
        </div>
        <button 
          className="sv-buy-btn" 
          onClick={(e) => {
            e.stopPropagation();
            addToCart(actualProduct || { id: item.id, name: item.title, price: item.price, image: displayImg });
          }}
          aria-label="Add to Cart"
        >
          <ShoppingBag size={18} />
        </button>
      </div>
    </div>
  );
}

export default function ShoppableVideos() {
  const sliderRef = useRef(null);
  const { addToCart } = useCart();
  const { products } = useProducts();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const videoData = baseVideoData;

  const scrollLeft = () => sliderRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  const scrollRight = () => sliderRef.current?.scrollBy({ left: 280, behavior: 'smooth' });

  return (
    <div className="shoppable-videos-container">
      <div className="reveal bento-header" style={{ background: 'linear-gradient(135deg, rgba(74,222,128,0.2) 0%, rgba(34,197,94,0.1) 100%)', borderColor: 'rgba(74,222,128,0.3)' }}>
        {/* Decorative background blob */}
        <div className="bento-header-blob right"></div>

        <div className="bento-title-col">
          <h2 className="bento-title-text">
            {(() => {
              const words = t('shopReelsTitle').split(' ');
              const lastWord = words.pop();
              return (
                <div style={{ flex: 1, minWidth: 0, wordWrap: 'break-word' }}>
                  {words.join(' ')} <span className="highlight">{lastWord}</span>
                </div>
              );
            })()}
          </h2>
        </div>

        <div className="bento-desc-col">
          <p className="bento-desc-text">
            {t('shopReelsDesc')}
          </p>
        </div>
      </div>

      <div className="sv-wrapper reveal">
        <button className="sv-nav-btn left" onClick={scrollLeft} aria-label="Scroll left">
          <ChevronLeft size={22} />
        </button>

        <div className="sv-track" ref={sliderRef}>
          {videoData.map((item, idx) => {
            // Find the actual product by matching the title/name
            const actualProduct = products?.find(
              (p) => p.name.toUpperCase().includes(item.title.toUpperCase()) || item.title.toUpperCase().includes(p.name.toUpperCase())
            );
            return (
              <LazyVideoCard 
                key={item.id} 
                item={item} 
                index={idx}
                addToCart={addToCart} 
                navigate={navigate}
                actualProduct={actualProduct}
              />
            );
          })}
        </div>

        <button className="sv-nav-btn right" onClick={scrollRight} aria-label="Scroll right">
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
