import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles, Leaf, ArrowRight } from 'lucide-react';
import { useLanguage, getCategoryDisplayName } from '../context/LanguageContext';
import { API_BASE_URL, resolveMediaUrl } from '../services/api';
import './CategoryStrip.css';

// Import custom generated category images matching premium organic blob style
import imgHair from '../assets/chemparuthi_shampoo_transparent_v3.webp';
import imgBody from '../assets/body_soap_transparent.webp';
import imgFood from '../assets/pirandai_pickle_transparent_v2.webp';
import imgSkin from '../assets/aloe_vera_face_pack_transparent.webp';
import imgHealth from '../assets/sathu_maavu_transparent.webp';
import imgBaby from '../assets/nalangu_powder_transparent_v2.webp';
import imgPoojas from '../assets/pooja_oil_transparent_v2.webp';
import imgBeverages from '../assets/beverage_transparent.webp';

const LOCAL_CATEGORY_IMAGES = {
  "Hair": imgHair,
  "Body": imgBody,
  "Food": imgFood,
  "Skin": imgSkin,
  "Health & Wellness": imgHealth,
  "Baby": imgBaby,
  "Poojas": imgPoojas,
  "Beverages": imgBeverages
};

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Hair" },
  { id: 2, name: "Skin" },
  { id: 3, name: "Baby" },
  { id: 4, name: "Body" },
  { id: 5, name: "Food" },
  { id: 6, name: "Health & Wellness" },
  { id: 7, name: "Beverages" },
  { id: 8, name: "Poojas" }
];

export default function CategoryStrip() {
  const location = useLocation();
  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem('dharani_categories_cache');
      const parsed = cached ? JSON.parse(cached) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) { }
    return DEFAULT_CATEGORIES;
  });

  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get('category');
  const { language, t } = useLanguage();

  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      checkScroll();
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [categories]);

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(`${API_BASE_URL}/categories/`, {
      signal: controller.signal,
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    })
      .then(res => {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(data => {
        let catsArray = [];
        if (Array.isArray(data)) {
          catsArray = data;
        } else if (data && Array.isArray(data.categories)) {
          catsArray = data.categories;
        } else if (data && Array.isArray(data.data)) {
          catsArray = data.data;
        } else if (data && Array.isArray(data.results)) {
          catsArray = data.results;
        }
        const preferredOrder = [
          "Hair",
          "Skin",
          "Baby",
          "Body",
          "Food",
          "Health & Wellness",
          "Beverages",
          "Poojas"
        ];

        catsArray.sort((a, b) => {
          const indexA = preferredOrder.indexOf(a.name);
          const indexB = preferredOrder.indexOf(b.name);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.name.localeCompare(b.name);
        });

        setCategories(catsArray);
        try {
          localStorage.setItem('dharani_categories_cache', JSON.stringify(catsArray));
        } catch (e) { }
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn('Unable to fetch categories, using cache/defaults:', err.message);
      });
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  // ONLY show on Home Page and Shop Page
  if (location.pathname !== '/' && location.pathname !== '/shop') {
    return null;
  }

  return (
    <section className="category-strip-container" id="categories" aria-label="Product Categories">
      {/* Category Strip Heading */}
      <div className="cat-strip-header-wrap">
        <div className="cat-strip-badge">
          <Leaf size={12} className="cat-badge-leaf" />
          <span>{language === 'ta' ? 'மூலிகைப் பிரிவுகள்' : 'AYURVEDIC CATEGORIES'}</span>
        </div>
        <h2 className="cat-strip-title">
          {language === 'ta' ? 'பாரம்பரிய மூலிகை நலப் பிரிவுகள்' : 'Explore by Wellness Category'}
        </h2>
      </div>

      <div className="category-strip-wrapper-rel">
        {/* Navigation Arrow Left (Desktop) */}
        {canScrollLeft && (
          <button
            type="button"
            className="cat-scroll-arrow cat-scroll-arrow-left"
            onClick={() => handleScroll('left')}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div className="category-strip-scroll" ref={scrollRef}>
          {/* "All" Hero Pod — clears category filter */}
          <Link
            to="/shop"
            className={`category-item category-arch-card cat-animate-up ${!activeCategory ? 'category-arch-card--active category-item--active' : ''}`}
            style={{ animationDelay: '0s' }}
          >
            <div className="cat-card-inner">
              <div className="cat-aura-glow cat-aura-all" />
              <div className="cat-shimmer-sweep" />

              <div className="cat-img-pod cat-img-pod-all">
                <div className="cat-all-hero-circle">
                  <Sparkles size={24} className="cat-sparkle-anim" />
                  <span className="cat-all-badge-text">{t('allCategory') || 'All'}</span>
                </div>
              </div>

              <div className="cat-label-pill">
                <span className="cat-label-name">{language === 'ta' ? 'அனைத்தும்' : 'Shop All'}</span>
                <span className="cat-label-arrow"><ArrowRight size={13} /></span>
              </div>
            </div>
          </Link>

          {categories.map((category, index) => {
            const categoryImage = resolveMediaUrl(category.image) || LOCAL_CATEGORY_IMAGES[category.name];
            const displayName = language === 'ta' ? getCategoryDisplayName(category.name, 'ta') : category.name;
            const isActive = activeCategory === category.name;

            return (
              <Link
                key={category.id}
                to={`/shop?category=${encodeURIComponent(category.name)}`}
                className={`category-item category-arch-card cat-animate-up ${isActive ? 'category-arch-card--active category-item--active' : ''}`}
                style={{ animationDelay: `${(index + 1) * 0.05}s` }}
              >
                <div className="cat-card-inner">
                  {/* Glowing Botanical Halo */}
                  <div className="cat-aura-glow" />

                  {/* Shimmer sweep on hover */}
                  <div className="cat-shimmer-sweep" />

                  {/* Steady Botanical Pedestal & Product Image */}
                  <div className="cat-img-pod">
                    <img
                      src={categoryImage ? `${categoryImage}?v=42` : ''}
                      alt={displayName}
                      className="cat-product-img"
                      loading="lazy"
                      decoding="async"
                      width="96"
                      height="96"
                    />
                  </div>

                  {/* Luxury Title Pill */}
                  <div className="cat-label-pill">
                    <span className="cat-label-name">{displayName}</span>
                    <span className="cat-label-arrow"><ChevronRight size={13} /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Navigation Arrow Right (Desktop) */}
        {canScrollRight && (
          <button
            type="button"
            className="cat-scroll-arrow cat-scroll-arrow-right"
            onClick={() => handleScroll('right')}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </section>
  );
}
