// src/pages/EventDetail.jsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Modal,
  Input,
} from 'antd';
import {
  UnorderedListOutlined,
  CodeOutlined,
  CopyOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './EventDetail.css';

const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  'https://port-0-ychat-lzgmwhc4d9883c97.sel4.cloudtype.app';

function YouTubeAuto({ videoId, autoplay = false, loop = false, aspectW = 16, aspectH = 9, title = 'YouTube video' }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    let mounted = true;

    const createPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setNeedsInteraction(true);
        return;
      }

      try {
        if (playerRef.current && playerRef.current.destroy) playerRef.current.destroy();
      } catch (e) {}

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          loop: loop ? 1 : 0,
          playlist: loop ? videoId : undefined,
        },
        events: {
          onReady: (e) => {
            if (!mounted) return;
            try {
              if (autoplay) {
                e.target.mute?.();
                const p = e.target.playVideo?.();
                setTimeout(() => {
                  try {
                    const state = e.target.getPlayerState?.();
                    if (typeof state === 'number' && state !== 1) {
                      setNeedsInteraction(true);
                    }
                  } catch (err) {
                    setNeedsInteraction(true);
                  }
                }, 600);
              }
              try {
                const iframe = playerRef.current.getIframe?.();
                if (iframe) iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
              } catch (err) {}
            } catch (err) {
              setNeedsInteraction(true);
            }
          },
          onError: () => {
            if (mounted) setNeedsInteraction(true);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }
      if (!window._ytApiReadyQueue) {
        window._ytApiReadyQueue = [];
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (typeof prev === 'function') prev();
          window._ytApiReadyQueue.forEach(cb => { try { cb(); } catch (_) {} });
          window._ytApiReadyQueue = [];
        };
      }
      window._ytApiReadyQueue.push(createPlayer);
    }

    return () => {
      mounted = false;
      try { playerRef.current?.destroy?.(); } catch (_) {}
    };
  }, [videoId, autoplay, loop]);

  const requestPlayByUser = () => {
    try {
      if (playerRef.current) {
        try { playerRef.current.unMute?.(); } catch (_) {}
        try { playerRef.current.playVideo?.(); } catch (_) {}
        setNeedsInteraction(false);
      } else {
        setNeedsInteraction(true);
      }
    } catch (e) {
      setNeedsInteraction(true);
    }
  };

  return (
    <div style={{ width: '100%', position: 'relative', aspectRatio: `${aspectW} / ${aspectH}` }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} aria-label={title} />
      {needsInteraction && (
        <div style={{
          position: 'absolute', inset: 0, display:'flex', alignItems:'center', justifyContent:'center',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.25), rgba(0,0,0,0.25))'
        }}>
          <button onClick={requestPlayByUser} style={{ padding: '10px 16px', fontSize: 16, borderRadius: 6 }}>
            ▶ 재생
          </button>
        </div>
      )}
    </div>
  );
}

export default function EventDetail() {
  const params        = new URLSearchParams(window.location.search);
  const paramMallId   = params.get('mall_id') || params.get('state');
  const storedMallId  = localStorage.getItem('mallId');
  const mallId        = paramMallId || storedMallId;
  const { id }        = useParams();
  const navigate      = useNavigate();

  const [event, setEvent] = useState(null);
  const [htmlModalVisible, setHtmlModalVisible] = useState(false);
  const [htmlCode, setHtmlCode] = useState('');
  const [activeTab, setActiveTab] = useState('0');
  const [messageApi, contextHolder] = message.useMessage();

  const escapeHtml = (s = '') =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  function parseYouTubeId(input) {
    if (!input) return null;
    if (/^[\w-]{11}$/.test(input)) return input;
    try {
      const url = new URL(String(input).trim());
      const host = url.hostname.replace('www.', '');
      if (host === 'youtu.be') return url.pathname.slice(1);
      if (host.includes('youtube.com')) {
        if (url.searchParams.get('v')) return url.searchParams.get('v');
        const m = url.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
        if (m) return m[2];
      }
    } catch (_) {}
    const m = String(input).match(/src=["']([^"']+)["']/i);
    if (m) return parseYouTubeId(m[1]);
    return null;
  }

  function buildYouTubeSrc(id, autoplay = false, loop = false) {
    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      mute: autoplay ? '1' : '0',
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
      enablejsapi: '1'
    });
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', id);
    }
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  }

  useEffect(() => {
    axios.get(`${API_BASE}/api/${mallId}/eventTemple/${id}`)
      .then(res => {
        const ev = res.data;

        ev.images = (ev.images || []).map(img => ({
          ...img,
          id: img._id || img.id,
          regions: (img.regions || []).map(r => ({
            ...r,
            id: r._id || r.id,
          })),
        }));

        const rawBlocks = Array.isArray(ev?.content?.blocks)
          ? ev.content.blocks
          : (ev.images || []).map(img => ({
              _id: img.id,
              type: 'image',
              src: img.src,
              regions: img.regions || []
            }));

        ev.blocks = rawBlocks.map(b => {
          const base = {
            id: b._id || b.id,
            type: b.type || 'image',
          };
          if ((b.type || 'image') === 'video') {
            return {
              ...base,
              youtubeId: b.youtubeId || parseYouTubeId(b.src),
              ratio: b.ratio || { w:16, h:9 },
              autoplay: b.autoplay === true || b.autoplay === 'true' || b.autoplay === 1 || b.autoplay === '1',
              loop: b.loop === true || b.loop === 'true' || b.loop === 1 || b.loop === '1'
            };
          }
          if (b.type === 'text') {
            return {
              ...base,
              text: b.text || '',
              style: b.style || {},
            };
          }
          return {
            ...base,
            src: b.src,
            regions: (b.regions || []).map(r => ({
              ...r,
              id: r._id || r.id,
            })),
          };
        });

        setEvent(ev);
      })
      .catch(() => {
        message.error('이벤트 로드 실패');
        navigate(`/event/list`);
      });
  }, [mallId, id, navigate]);

  if (!event) return null;

  const {
    title,
    layoutType,
    gridSize,
    classification = {},
  } = event;

  const directProducts = classification.directProducts || [];
  const activeColor    = classification.activeColor   || '#1890ff';
  const tabs           = classification.tabs          || [];
  const singleRoot     = classification.root;
  const singleSub      = classification.sub;

  // ---------- NEW: decide whether to show product widget at all ----------
  const showProductWidget = (() => {
    // 1) if registerMode explicitly 'none' => don't show
    if (classification.registerMode === 'none') return false;

    // 2) for single layout: require at least category (root/sub) or direct products
    if (layoutType === 'single') {
      const cate = singleSub || singleRoot;
      const hasDirect = Array.isArray(directProducts) && directProducts.length > 0;
      return Boolean(cate) || hasDirect;
    }

    // 3) for tabs layout: at least one tab with category (root/sub) or direct products
    if (layoutType === 'tabs') {
      const hasTabCate = Array.isArray(tabs) && tabs.some(t => Boolean(t && (t.sub || t.root)));
      const tabDirect = classification.tabDirectProducts || {};
      const hasTabDirect = Object.values(tabDirect).some(arr => Array.isArray(arr) && arr.length > 0);
      return hasTabCate || hasTabDirect;
    }

    // default: don't show
    return false;
  })();
  // -----------------------------------------------------------------------

  const renderGrid = cols => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols},1fr)`,
      gap: 10,
      maxWidth: 800,
      margin: '24px auto'
    }}>
      {Array.from({ length: cols * cols }).map((_, i) => (
        <div key={i} style={{
          height: 120,
          background: '#f0f0f0',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999'
        }}>
          <BlockOutlined style={{ fontSize: 32, color: '#ccc' }} />
        </div>
      ))}
    </div>
  );

  const downloadCoupon = couponNo => {
    const couponUrl = `/exec/front/newcoupon/IssueDownload?coupon_no=${couponNo}`;
    window.location.href = couponUrl +
      `&opener_url=${encodeURIComponent(window.location.href)}`;
  };

  // ---------- handleShowHtml (kept from previous safe implementation) ----------
  const handleShowHtml = () => {
    const attrIf = (name, val) => {
      if (val === undefined || val === null) return '';
      const s = String(val);
      if (s === '' || s === 'undefined' || s === 'null') return '';
      return ` ${name}="${s.replace(/"/g, '&quot;')}"`;
    };

    let html = `<!--@layout(/layout/basic/layout.html)-->\n\n`;

    const allBlocks = (event.blocks && event.blocks.length
      ? event.blocks
      : (event.images || []).map(img => ({
          id: img.id || img._id,
          type: 'image',
          src: img.src,
          regions: img.regions || []
        }))
    ).map(b => {
      const t = b.type || 'image';
      if (t === 'video') {
        return {
          id: b.id || b._id,
          type: 'video',
          youtubeId: b.youtubeId || parseYouTubeId(b.src),
          ratio: b.ratio || { w:16, h:9 },
          autoplay: b.autoplay === true || b.autoplay === 'true' || b.autoplay === 1 || b.autoplay === '1',
          loop: b.loop === true || b.loop === 'true' || b.loop === 1 || b.loop === '1'
        };
      }

      if (t === 'text') {
        return {
          id: b.id || b._id,
          type: 'text',
          text: b.text || '',
          style: b.style || {}
        };
      }
      return {
        id: b.id || b._id,
        type: 'image',
        src: b.src,
        regions: (b.regions || []).map(r => ({
          id: r.id || r._id,
          xRatio: r.xRatio, yRatio: r.yRatio, wRatio: r.wRatio, hRatio: r.hRatio,
          href: r.href, coupon: r.coupon
        }))
      };
    });

    html += `<div id="evt-images"></div>\n\n`;

    const couponList = Array.from(new Set(
      allBlocks
        .filter(b => b.type === 'image')
        .flatMap(b => (b.regions || [])
          .filter(r => r.coupon)
          .map(r => r.coupon))
    ));
    const couponAttr = couponList.length ? ` data-coupon-nos="${couponList.join(',')}"` : '';

    if (layoutType === 'tabs') {
      html += `<div class="tabs_${id}">\n`;
      (classification.tabs || []).forEach((t, i) => {
        const titleText = t.title || `탭${i+1}`;
        html += `  <button class="${i === 0 ? 'active' : ''}" onclick="showTab('tab-${i}',this)">${titleText}</button>\n`;
      });
      html += `</div>\n\n`;

      (classification.tabs || []).forEach((t, i) => {
        const disp = i === 0 ? 'block' : 'none';
        const cate = t.sub || t.root;
        const tabDirect = (classification.tabDirectProducts || {})[i] || [];
        const tabIds    = tabDirect
          .map(p => (typeof p === 'object' ? p.product_no : p))
          .filter(Boolean)
          .join(',');

        if (!cate && !tabIds) {
          html += `<div id="tab-${i}" class="tab-content_${id}" style="display:${disp}">\n`;
          html += `  <!-- no category or direct product configured for this tab -->\n`;
          html += `</div>\n\n`;
          return;
        }

        const cateAttr = attrIf('data-cate', cate);
        const directAttrForTab = tabIds ? ` data-direct-nos="${tabIds}"` : '';
        html += `<div id="tab-${i}" class="tab-content_${id}" style="display:${disp}">\n`;
        html += `  <ul class="main_Grid_${id}"${cateAttr} data-grid-size="${gridSize}"${directAttrForTab}></ul>\n`;
        html += `</div>\n\n`;
      });

    } else if (layoutType === 'single') {
      const cate = singleSub || singleRoot;
      const singleIds = directProducts
        .map(p => (typeof p === 'object' ? p.product_no : p))
        .filter(Boolean)
        .join(',');

      if (!cate && !singleIds) {
        html += `<!-- no category or direct products configured for single layout -->\n\n`;
      } else {
        const cateAttr = attrIf('data-cate', cate);
        const directAttrForSingle = singleIds ? ` data-direct-nos="${singleIds}"` : '';
        html += `<div class="product_list_widget">\n`;
        html += `  <ul class="main_Grid_${id}"${cateAttr} data-grid-size="${gridSize}"${directAttrForSingle}></ul>\n`;
        html += `</div>\n\n`;
      }
    }

    const hasAnyAutoplay = allBlocks.some(b => b.type === 'video' && Boolean(b.autoplay));
    const hasAnyLoop = allBlocks.some(b => b.type === 'video' && Boolean(b.loop));
    const scriptAttrs = [
      `src="${API_BASE}/widget.js"`,
      hasAnyAutoplay ? `data-autoplay-all="1"` : '',
      hasAnyLoop ? `data-loop-all="1"` : '',
      `data-mall-id="${mallId || ''}"`,
      `data-page-id="${id}"`,
      `data-api-base="${API_BASE}"`,
      `data-tab-count="${(classification.tabs || []).length}"`,
      `data-active-color="${classification.activeColor || '#1890ff'}"`,
      couponAttr
    ].filter(Boolean).join(' ');

    html += `<script ${scriptAttrs}></script>\n`;

    setHtmlCode(html);
    setHtmlModalVisible(true);
  };
  // -----------------------------------------------------------------------

  const handleCopy = async () => {
    await navigator.clipboard.writeText(htmlCode);
    message.success('코드 복사 완료');
    setHtmlModalVisible(false);
  };

  return (
    <>
      {contextHolder}
      <Card
        title={title}
        className="event-detail-card"
        style={{ '--active-color': activeColor }}
        extra={
          <Space>
            <Button
              icon={<UnorderedListOutlined />}
              onClick={() => navigate(`/event/list`)}>
              목록
            </Button>
            <Button icon={<CodeOutlined />} onClick={handleShowHtml}>
              HTML
            </Button>
          </Space>
        }
      >

        {/* 1) 블록(이미지/영상/텍스트) 렌더링 */}
        <div style={{ display:'grid', gap:0, maxWidth:800, margin:'0 auto' }}>
          {(event.blocks || []).map((block, idx) => {
            if (block.type === 'video') {
              const yid = block.youtubeId || parseYouTubeId(block.src);
              return (
                <div key={block.id} style={{ width:'100%' }}>
                  <YouTubeAuto
                    videoId={yid}
                    aspectW={block.ratio?.w || 16}
                    aspectH={block.ratio?.h || 9}
                    autoplay={!!block.autoplay}
                    loop={!!block.loop}
                    title={`youtube-${yid || 'preview'}`}
                  />
                </div>
              );
            }
            if (block.type === 'text') {
              const st = block.style || {};
              return (
                <div
                  key={block.id}
                  style={{
                    textAlign: st.align || 'center',
                    marginTop: st.mt ?? 16,
                    marginBottom: st.mb ?? 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: st.fontSize || 18,
                      fontWeight: st.fontWeight || 'normal',
                      color: st.color || '#333',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: escapeHtml(block.text || '').replace(/\n/g, '<br/>'),
                    }}
                  />
                </div>
              );
            }
            return (
              <div key={block.id} style={{ position:'relative', width:'100%', fontSize:0, margin:'0 auto' }}>
                <img src={block.src} alt={`img-${idx}`} style={{ width:'100%' }} draggable={false} />
                {(block.regions || []).map(r => {
                  const l = (r.xRatio * 100).toFixed(2);
                  const t = (r.yRatio * 100).toFixed(2);
                  const w = (r.wRatio * 100).toFixed(2);
                  const h = (r.hRatio * 100).toFixed(2);
                  const style = {
                    position:'absolute',
                    left:`${l}%`, top:`${t}%`, width:`${w}%`, height:`${h}%`,
                    cursor:'pointer',
                    border: r.coupon ? '2px dashed #ff6347' : `2px dashed ${activeColor}`,
                    background: r.coupon ? 'rgba(255,99,71,0.2)' : 'rgba(24,144,255,0.2)',
                  };
                  if (r.coupon) {
                    const coupons = Array.isArray(r.coupon) ? r.coupon : [r.coupon];
                    return (
                      <button
                        key={r.id}
                        style={style}
                        onClick={() => coupons.forEach(cpn => downloadCoupon(cpn))}
                      />
                    );
                  } else {
                    let hrefVal = r.href;
                    if (!/^https?:\/\//.test(hrefVal)) hrefVal = 'https://' + hrefVal;
                    return (
                      <a
                        key={r.id}
                        href={hrefVal}
                        target="_blank"
                        rel="noreferrer"
                        style={style}
                      />
                    );
                  }
                })}
              </div>
            );
          })}
        </div>

        {/* 2) 상품 그리드 — 이제 showProductWidget이 true일 때만 노출 */}
        { !showProductWidget && (
          // 숨기고 싶은 영역이 완전히 사라지도록 아무것도 렌더하지 않음
          null
        )}

        { showProductWidget && layoutType === 'single' && renderGrid(gridSize) }

        { showProductWidget && layoutType === 'tabs' && (
          <>
            <div style={{
              display:'grid', gap:8,
              gridTemplateColumns:`repeat(${tabs.length},1fr)`,
              maxWidth:800, margin:'16px auto'
            }}>
              {tabs.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(String(i))}
                  className={activeTab === String(i) ? 'active' : ''}
                  style={{
                    padding:8, fontSize:16, border:'none',
                    background: activeTab === String(i) ? activeColor : '#f5f5f5',
                    color: activeTab === String(i) ? '#fff' : '#333',
                    borderRadius:4, cursor:'pointer',
                    display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                    overflow:'hidden', textOverflow:'ellipsis'
                  }}
                >
                  {t.title || `탭${i+1}`}
                </button>
              ))}
            </div>
            { renderGrid(gridSize) }
          </>
        )}

      </Card>

      <Modal
        title="전체 HTML 코드"
        open={htmlModalVisible}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
            복사
          </Button>,
          <Button key="close" onClick={() => setHtmlModalVisible(false)}>
            닫기
          </Button>,
        ]}
        onCancel={() => setHtmlModalVisible(false)}
        width={800}
      >
        <Input.TextArea value={htmlCode} rows={16} readOnly />
      </Modal>
    </>
  );
}
