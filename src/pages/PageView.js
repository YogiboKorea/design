// src/pages/StatEventVisitors.jsx

import React, { useEffect, useState } from 'react';
import {
  Card,
  Select,
  DatePicker,
  Button,
  Table,
  Space,
  message,
  Grid,
} from 'antd';
import api from '../axios';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import './NormalSection.css';

dayjs.extend(isSameOrBefore);

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

export default function StatEventVisitors() {
  // ─── mallId 결정 ─────────────────────────────────────────
  const [mallId, setMallId] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('mall_id') || params.get('state') || params.get('mallId');
    if (q) {
      localStorage.setItem('mallId', q);
      setMallId(q);
    } else {
      const stored = localStorage.getItem('mallId');
      if (stored) setMallId(stored);
      else message.error('mall_id 파라미터가 없습니다.');
    }
  }, []);

  const screens = useBreakpoint();
  const isMobile = !screens.sm;

  // ─── 상태 선언 ───────────────────────────────────────────
  const [events, setEvents]               = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [urls, setUrls]                   = useState([]); // 원본 URL 리스트
  const [urlOptions, setUrlOptions]       = useState([]); // select options (label/value/title)
  const [urlMap, setUrlMap]               = useState(new Map()); // normalized -> [originals]
  const [selectedUrl, setSelectedUrl]     = useState(null); // 정규화된 값으로 저장

  const [range, setRange]                 = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [minDate, setMinDate]             = useState(null);

  const [data, setData]                   = useState([]);
  const [loading, setLoading]             = useState(false);

  // ─── helper: 정규화 (앞부분 skin-..., 숫자/슬래시 제거, 쿼리/해시 제거, trim) ─────────
  const normalizePath = (urlCandidate) => {
    if (!urlCandidate) return '/';
    // 절대 URL이면 pathname만 추출해서 정규화 (쿼리/해시 제거)
    if (/^https?:\/\//i.test(urlCandidate)) {
      try {
        const p = new URL(urlCandidate);
        urlCandidate = p.pathname || '';
      } catch (e) {
        urlCandidate = String(urlCandidate);
      }
    }

    let s = String(urlCandidate).trim();

    // 쿼리나 해시 제거
    s = s.split(/[?#]/)[0];

    // remove leading slashes
    s = s.replace(/^\/+/, '');

    if (!s) return '/';

    // strip trailing slashes
    s = s.replace(/\/+$/, '');

    // patterns to strip repeatedly from the start:
    const patterns = [
      /^skin-mobile\/?/i,
      /^skin-[^\/]+\/?/i,
      /^\d+\/?/
    ];

    let changed = true;
    while (changed) {
      changed = false;
      for (const p of patterns) {
        if (p.test(s)) {
          s = s.replace(p, '');
          changed = true;
        }
      }
    }

    if (!s) return '/';
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  };

  // ─── 1) 이벤트 목록 로드 & 기본 설정 ───────────────────────
  useEffect(() => {
    if (!mallId) return;
    api.get(`/api/${mallId}/events`)
      .then(res => {
        const opts = (res.data || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(ev => ({
            label:     ev.title || '(제목없음)',
            value:     ev._id,
            createdAt: ev.createdAt,
          }));
        setEvents(opts);
        if (opts.length) {
          const { value, createdAt } = opts[0];
          setSelectedEvent(value);
          const start = dayjs(createdAt);
          setMinDate(start);
          setRange([start, dayjs()]);
        }
      })
      .catch(err => {
        console.error('[EVENTS LOAD ERROR]', err);
        message.error('이벤트 목록을 불러오지 못했습니다.');
      });
  }, [mallId]);

  // ─── 2) URL 목록 & 날짜 최소값 재설정 ───────────────────────
  useEffect(() => {
    if (!mallId || !selectedEvent) {
      setUrls([]);
      setUrlOptions([]);
      setUrlMap(new Map());
      setSelectedUrl(null);
      setMinDate(null);
      return;
    }

    // URL 목록
    api.get(`/api/${mallId}/analytics/${selectedEvent}/urls`)
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setUrls(list);

        // normalized map 생성
        const normalizedMap = new Map();
        for (const orig of list) {
          const n = normalizePath(orig);
          if (!normalizedMap.has(n)) normalizedMap.set(n, [orig]);
          else normalizedMap.get(n).push(orig);
        }

        // options 생성: label은 "/test1.html (2)" 같이 보이고, value는 정규화된 값,
        // title에 원본을 join 해두면 브라우저 툴팁으로 확인 가능
        const options = Array.from(normalizedMap.entries()).map(([norm, originals]) => {
          const count = originals.length;
          const label = count > 1 ? `${norm}` : norm;
          return { label, value: norm };
        });

        setUrlOptions(options);
        setUrlMap(normalizedMap);
        setSelectedUrl(options.length ? options[0].value : null);
      })
      .catch(err => {
        console.error('[URLS LOAD ERROR]', err);
        message.error('URL 목록을 불러오지 못했습니다.');
        setUrls([]);
        setUrlOptions([]);
        setUrlMap(new Map());
        setSelectedUrl(null);
      });

    // 최소날짜(이벤트 생성일)
    const ev = events.find(e => e.value === selectedEvent);
    if (ev) {
      const start = dayjs(ev.createdAt);
      setMinDate(start);
      setRange([start, dayjs()]);
    }
  }, [mallId, selectedEvent, events]);

  // ─── helper: 후보 URL 배열 생성 (정규화 + 원본 + 변형(슬래시 유무)) ─────────────────
  const buildUrlCandidates = (normalized) => {
    const candidates = new Set();
    if (!normalized) return [];
    // normalized (leading slash)
    candidates.add(normalized);
    // without leading slash
    candidates.add(normalized.replace(/^\//, ''));
    // if urlMap has originals, add them + their slash/no-slash variants
    const originals = urlMap.get(normalized) || [];
    originals.forEach(o => {
      candidates.add(o);
      candidates.add(o.replace(/^\/+/, ''));
      // also try versions stripped of query/hash
      candidates.add(String(o).split(/[?#]/)[0]);
      candidates.add(String(o).split(/[?#]/)[0].replace(/^\/+/, ''));
    });
    return Array.from(candidates);
  };

  // ─── helper: 여러 API 응답을 날짜별로 합병 (sum numeric fields) ───────────────
  const mergeResponsesByDate = (responsesArray) => {
    // responsesArray: array of arrays (each inner is [{date, totalVisitors, newVisitors, returningVisitors, revisitRate?}, ...])
    const map = new Map();
    responsesArray.forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(rec => {
        const date = rec.date;
        if (!map.has(date)) {
          // copy numeric fields defensively
          map.set(date, {
            date,
            totalVisitors: rec.totalVisitors || 0,
            newVisitors: rec.newVisitors || 0,
            returningVisitors: rec.returningVisitors || 0,
            // revisitRate left as-is (we'll compute later if needed)
            revisitRate: rec.revisitRate || '0 %'
          });
        } else {
          const cur = map.get(date);
          cur.totalVisitors += rec.totalVisitors || 0;
          cur.newVisitors += rec.newVisitors || 0;
          cur.returningVisitors += rec.returningVisitors || 0;
          // revisitRate recompute as new/total if total > 0
          if (cur.totalVisitors > 0) {
            const rate = Math.round((cur.returningVisitors / cur.totalVisitors) * 100);
            cur.revisitRate = `${rate} %`;
          } else {
            cur.revisitRate = '0 %';
          }
        }
      });
    });

    // produce sorted array by date (ascending)
    return Array.from(map.values()).sort((a,b) => a.date.localeCompare(b.date));
  };

  // ─── 3) 방문자 통계 조회 (개선판: 후보 URL 여러개로 시도/병합) ─────────────────
  const fetchStats = async () => {
    if (!mallId || !selectedEvent) {
      message.warning('이벤트를 선택하세요.');
      return;
    }
    if (!selectedUrl) {
      message.warning('URL을 선택하세요.');
      return;
    }

    setLoading(true);
    const [start, end] = range.map(d => d.format('YYYY-MM-DD'));

    try {
      const normalizedSelected = normalizePath(selectedUrl);
      const candidates = buildUrlCandidates(normalizedSelected);
      if (candidates.length === 0) {
        // fallback: single normalized
        candidates.push(normalizedSelected);
      }

      // 병렬로 각 후보 URL에 대해 API 호출 (실패하면 빈 배열로)
      const promises = candidates.map(candidate =>
        api.get(`/api/${mallId}/analytics/${selectedEvent}/visitors-by-date`, {
          params: {
            start_date: `${start}T00:00:00+09:00`,
            end_date:   `${end}T23:59:59.999+09:00`,
            url:        candidate,
          }
        })
        .then(res => Array.isArray(res.data) ? res.data : [])
        .catch(err => {
          // 콘솔에 에러만 남기고 빈 배열 반환 — 다른 후보가 보완할 수 있음
          console.warn('visitors-by-date failed for', candidate, err && err.message);
          return [];
        })
      );

      const responses = await Promise.all(promises); // array of arrays
      // 합병
      const merged = mergeResponsesByDate(responses);

      // 날짜 축 생성 및 빈 날짜 채우기 (원래 로직과 동일하게)
      const days = [];
      let cur = range[0].startOf('day'),
          last = range[1].startOf('day');
      while (cur.isSameOrBefore(last, 'day')) {
        days.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }

      // create lookup from merged
      const lookup = new Map(merged.map(o => [o.date, o]));
      const tableData = days.map(date => {
        const o = lookup.get(date) || {};
        return {
          key:               date,
          date,
          totalVisitors:     o.totalVisitors     || 0,
          newVisitors:       o.newVisitors       || 0,
          returningVisitors: o.returningVisitors || 0,
          revisitRate:       o.revisitRate       || '0 %',
        };
      });

      setData(tableData);
    } catch (err) {
      console.error('[STATS LOAD ERROR]', err);
      message.error('통계 데이터를 불러오지 못했습니다.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 4) 선택 변경 시 자동 조회 ─────────────────────────────
  useEffect(() => {
    if (mallId && selectedEvent && selectedUrl) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mallId, selectedEvent, selectedUrl, range]);

  // ─── 5) 테이블 컬럼 정의 ─────────────────────────────────
  const columns = [
    { title: '날짜',        dataIndex: 'date',              key: 'date' },
    { title: '총 방문자',   dataIndex: 'totalVisitors',     key: 'totalVisitors',     align: 'right' },
    { title: '신규 방문자', dataIndex: 'newVisitors',       key: 'newVisitors',       align: 'right' },
    { title: '재방문자',    dataIndex: 'returningVisitors', key: 'returningVisitors', align: 'right' },
    { title: '재방문 비율', dataIndex: 'revisitRate',       key: 'revisitRate',       align: 'right' },
  ];

  return (
    <Card
      className="pageView"
      title="이벤트 방문자 통계 (일별)"
      extra={(
        <Space wrap size={isMobile ? 'small' : 'middle'} style={isMobile ? { width:'100%' } : undefined}>
          <Select
            placeholder="이벤트 선택"
            options={events}
            value={selectedEvent}
            onChange={setSelectedEvent}
            allowClear
            style={{ width: isMobile ? '100%' : 200, minWidth: 120 }}
          />
          <Select
            placeholder="URL 선택"
            options={urlOptions}
            value={selectedUrl}
            onChange={setSelectedUrl}
            allowClear
            style={{ width: isMobile ? '100%' : 240, minWidth: 120 }}
            showSearch
            optionLabelProp="value"
            filterOption={(input, option) => {
              const val = (option?.value || '').toString().toLowerCase();
              const lab = (option?.label || '').toString().toLowerCase();
              const needle = (input || '').toLowerCase();
              return val.includes(needle) || lab.includes(needle);
            }}
          />

          {isMobile ? (
            <Space direction="vertical" size="small" style={{ width:'100%' }}>
              <DatePicker
                value={range[0]}
                format="YYYY-MM-DD"
                onChange={d => d && setRange([d, range[1]])}
                disabledDate={d => minDate && d.isBefore(minDate, 'day')}
                style={{ width:'100%' }}
                allowClear={false}
              />
              <DatePicker
                value={range[1]}
                format="YYYY-MM-DD"
                onChange={d => d && setRange([range[0], d])}
                disabledDate={d => minDate && d.isBefore(minDate, 'day')}
                style={{ width:'100%' }}
                allowClear={false}
              />
            </Space>
          ) : (
            <RangePicker
              value={range}
              format="YYYY-MM-DD"
              onChange={setRange}
              disabledDate={d => minDate && d.isBefore(minDate, 'day')}
              style={{ width: 280, minWidth: 160 }}
              allowClear={false}
            />
          )}

          <Button type="primary" loading={loading} onClick={fetchStats} block={isMobile}>
            조회
          </Button>
        </Space>
      )}
      style={{ width:'100%', maxWidth:1700, margin:'0 auto' }}
      bodyStyle={{ padding: isMobile ? 12 : 24 }}
    >
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        bordered
        locale={{ emptyText: '조회된 데이터가 없습니다.' }}
        scroll={{ x: isMobile ? 'max-content' : undefined }}
      />
    </Card>
  );
}
