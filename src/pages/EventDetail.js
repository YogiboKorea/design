// src/pages/EventDetail.jsx

import React, { useEffect, useState } from 'react';
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

  // ── helper: escape for text -> <br/>
  const escapeHtml = (s = '') =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // ── YouTube ID 파서 (URL/ID/iframe src 모두 대응)
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

  // YouTube src 빌더 (autoplay, mute, loop(playlist) 포함)
  function buildYouTubeSrc(id, autoplay = false, loop = false) {
    const params = new URLSearchParams({
      autoplay: autoplay ? '1' : '0',
      mute: autoplay ? '1' : '0', // autoplay on -> mute recommended for mobile autoplay
      playsinline: '1',
      rel: '0',
      modestbranding: '1',
    });
    if (loop) {
      params.set('loop', '1');
      params.set('playlist', id);
    }
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  }

  // 반응형 YouTube 임베드 (상세 페이지 화면용)
  function YouTubeEmbed({ id, ratioW = 16, ratioH = 9, title = 'YouTube video', autoplay = false, loop = false }) {
    if (!id) {
      return (
        <div style={{
          width:'100%', maxWidth:800, margin:'0 auto',
          background:'#eee', color:'#666',
          display:'flex', alignItems:'center', justifyContent:'center',
          height: Math.round((ratioH/ratioW) * 800)
        }}>
          <span style={{fontSize:14}}>영상 블록 (ID 없음)</span>
        </div>
      );
    }

    const src = buildYouTubeSrc(id, autoplay, loop);
    const paddingTop = `${(ratioH/ratioW) * 100}%`;

    return (
      <div style={{ width:'100%', maxWidth:800, margin:'0 auto' }}>
        <div style={{ position:'relative', width:'100%', paddingTop, aspectRatio: `${ratioW} / ${ratioH}` }}>
          <iframe
            src={src}
            title={title}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:0 }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    );
  }


  // 1) 이벤트 데이터 로드 (+ blocks 정규화)
  useEffect(() => {
    axios.get(`${API_BASE}/api/${mallId}/eventTemple/${id}`)
      .then(res => {
        const ev = res.data;

        // images/regions id 매핑 (하위호환)
        ev.images = (ev.images || []).map(img => ({
          ...img,
          id: img._id || img.id,
          regions: (img.regions || []).map(r => ({
            ...r,
            id: r._id || r.id,
          })),
        }));

        // content.blocks가 있으면 우선 사용, 없으면 images → image blocks로 변환
        const rawBlocks = Array.isArray(ev?.content?.blocks)
          ? ev.content.blocks
          : (ev.images || []).map(img => ({
              _id: img.id,
              type: 'image',
              src: img.src,
              regions: img.regions || []
            }));

        // 블록 정규화 (image / video / text)
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
              style: b.style || {}, // {align,fontSize,fontWeight,color,mt,mb}
            };
          }
          // image
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

  // 자리표시 그리드
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

  // 쿠폰 다운로드
  const downloadCoupon = couponNo => {
    const couponUrl = `/exec/front/newcoupon/IssueDownload?coupon_no=${couponNo}`;
    window.location.href = couponUrl +
      `&opener_url=${encodeURIComponent(window.location.href)}`;
  };

  // HTML 생성 & 모달 열기
  const handleShowHtml = () => {
    let html = `<!--@layout(/layout/basic/layout.html)-->\n\n`;

    // 1) 렌더 스냅샷 (server blocks 우선)
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
      // image
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


    // ✅ 텍스트를 따로 빼지 않고 widget.js가 순서대로 렌더하도록 컨테이너만 남김
    html += `<div id="evt-images"></div>\n\n`;

    // 이미지 블록의 쿠폰 수집 → widget.js 전달
    const couponList = Array.from(new Set(
      allBlocks
        .filter(b => b.type === 'image')
        .flatMap(b => (b.regions || [])
          .filter(r => r.coupon)
          .map(r => r.coupon))
    ));
    const couponAttr = couponList.length
      ? ` data-coupon-nos="${couponList.join(',')}"`
      : '';

    // 2) 탭/싱글 레이아웃 HTML (상품 영역 자리)
    if (layoutType === 'tabs') {
      html += `<div class="tabs_${id}">\n`;
      (classification.tabs || []).forEach((t, i) => {
        html += `  <button class="${i === 0 ? 'active' : ''}" onclick="showTab('tab-${i}',this)">${t.title || `탭${i+1}`}</button>\n`;
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
        const directAttrForTab = tabIds ? ` data-direct-nos="${tabIds}"` : '';

        html += `<div id="tab-${i}" class="tab-content_${id}" style="display:${disp}">\n`;
        html += `  <ul class="main_Grid_${id}" data-cate="${cate}" data-grid-size="${gridSize}"${directAttrForTab}></ul>\n`;
        html += `</div>\n\n`;
      });

    } else if (layoutType === 'single') {
      const cate = singleSub || singleRoot;
      const singleIds = directProducts
        .map(p => (typeof p === 'object' ? p.product_no : p))
        .filter(Boolean)
        .join(',');
      const directAttrForSingle = singleIds ? ` data-direct-nos="${singleIds}"` : '';

      html += `<div class="product_list_widget">\n`;
      html += `  <ul class="main_Grid_${id}" data-cate="${cate}" data-grid-size="${gridSize}"${directAttrForSingle}></ul>\n`;
      html += `</div>\n\n`;
    }
    const hasAnyAutoplay = allBlocks.some(b => b.type === 'video' && Boolean(b.autoplay));
    const hasAnyLoop = allBlocks.some(b => b.type === 'video' && Boolean(b.loop));
    // 3) widget.js 태그 (DB에서 page-id로 블록을 가져가므로 inline JSON 없음)
    //    ⚠️ data-ignore-text 제거 → 텍스트도 순서대로 렌더됨
    const scriptAttrs = [
      `src="${API_BASE}/widget.js"`,
      hasAnyAutoplay ? `data-autoplay-all="1"` : '',
      hasAnyLoop ? `data-loop-all="1"` : '',
      `data-mall-id="${mallId || ''}"`,
      `data-page-id="${id}"`,
      `data-api-base="${API_BASE}"`,
      `data-tab-count="${(classification.tabs || []).length}"`,
      `data-active-color="${classification.activeColor || '#1890ff'}"`,
      // `data-render-text="1"` // 명시하고 싶다면 주석 해제
      couponAttr
    ].filter(Boolean).join(' ');

    html += `<script ${scriptAttrs}></script>\n`;

    setHtmlCode(html);
    setHtmlModalVisible(true);
  };

  // HTML 복사
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

        {/* 1) 블록(이미지/영상/텍스트) 렌더링 (관리자 상세 화면용 미리보기) */}
        <div style={{ display:'grid', gap:0, maxWidth:800, margin:'0 auto' }}>
          {(event.blocks || []).map((block, idx) => {
            if (block.type === 'video') {
              const yid = block.youtubeId || parseYouTubeId(block.src);
              return (
                <div key={block.id} style={{ width:'100%' }}>
                  <YouTubeEmbed
                    id={yid}
                    ratioW={block.ratio?.w || 16}
                    ratioH={block.ratio?.h || 9}
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
            // 이미지 + 영역
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

        {/* 2) 상품 그리드 (자리표시) */}
        {layoutType === 'none' && (
          <p style={{ textAlign:'center', marginTop:24 }}>
            {/* 상품을 노출하지 않습니다. */}
          </p>
        )}
        {layoutType === 'single' && renderGrid(gridSize)}
        {layoutType === 'tabs' && (
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
            {renderGrid(gridSize)}
          </>
        )}

      </Card>

      {/* HTML 모달 */}
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
