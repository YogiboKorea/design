// src/pages/Dashboard.jsx

import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Statistic,
  message,
  Space,
  Button,
  Table
} from 'antd';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import api from '../axios';
import './NormalSection.css';

const { RangePicker } = DatePicker;

export default function Dashboard() {
  // ─── mallId 결정 ───────────────────────────────────────────
  const [mallId, setMallId] = useState(null);
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const qMallId ='yogibo'
    if (qMallId) {
      localStorage.setItem('mallId', qMallId);
      setMallId(qMallId);
    } else {
      const stored = localStorage.getItem('mallId');
      if (stored) setMallId(stored);
      else message.error('mall_id 파라미터가 없습니다.');
    }
  }, []);

  // ─── 상태 선언 ───────────────────────────────────────────────
  const [events, setEvents]               = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [urls, setUrls]                   = useState([]);
  const [selectedUrl, setSelectedUrl]     = useState(null);

  const [range, setRange]     = useState([dayjs().subtract(6, 'day'), dayjs()]);
  const [minDate, setMinDate] = useState(null);
  const [dates, setDates]     = useState([]);

  const [newByDate, setNewByDate] = useState([]);
  const [retByDate, setRetByDate] = useState([]);
  const [pcByDate, setPcByDate]   = useState([]);
  const [andByDate, setAndByDate] = useState([]);
  const [iosByDate, setIosByDate] = useState([]);

  const [eventCount, setEventCount]     = useState(0);
  const [couponCount, setCouponCount]   = useState(0);
  const [prodPerf, setProdPerf]         = useState([]);

  // 쿠폰 통계용 상태
  const [couponNos, setCouponNos]       = useState([]);
  const [couponStats, setCouponStats]   = useState([]);
  const [couponTotals, setCouponTotals] = useState({
    issued: 0, used: 0, unused: 0, autoDel: 0
  });

  const [loading, setLoading] = useState(false);

  // ─── 이벤트 목록 & 쿠폰 개수 로드 ──────────────────────────────
  useEffect(() => {
    if (!mallId) return;
    api.get(`/api/${mallId}/eventTemple`)
      .then(({ data }) => {
        const evs = (data || []).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        setEvents(evs);
        setEventCount(evs.length);
        if (evs.length) setSelectedEvent(evs[0]._id);
      })
      .catch(() => message.error('이벤트 목록을 불러오지 못했습니다.'));
    api.get(`/api/${mallId}/coupons`)
      .then(res => setCouponCount(res.data.length))
      .catch(() => {});
  }, [mallId]);

  // ─── selectedEvent 변경 시: URL 목록 + 쿠폰 목록 + 날짜 초기화 ───────
  useEffect(() => {
    setCouponStats([]);
    setCouponTotals({ issued:0, used:0, unused:0, autoDel:0 });
    setCouponNos([]);

    if (!mallId || !selectedEvent) {
      setUrls([]); setSelectedUrl(null); setMinDate(null);
      return;
    }

    const ev = events.find(e => e._id === selectedEvent);
    if (ev?.createdAt) {
      const created = dayjs(ev.createdAt);
      setMinDate(created);
      setRange([created, dayjs()]);
    }

    api.get(`/api/${mallId}/analytics/${selectedEvent}/urls`)
      .then(res => {
        const list = res.data || [];
        setUrls(list);
        // 기본 선택: 가장 최근에 등록된 URL이 앞쪽에 오도록 보장되어 있다면 list[0]을 사용
        setSelectedUrl(list[0] || null);
      })
      .catch(() => message.error('URL 목록을 불러오지 못했습니다.'));

    api.get(`/api/${mallId}/eventTemple/${selectedEvent}`)
      .then(({ data }) => {
        const all = [];
        (data.images || []).forEach(img =>
          (img.regions || []).forEach(r => {
            if (r.coupon) {
              Array.isArray(r.coupon) ? all.push(...r.coupon) : all.push(r.coupon);
            }
          })
        );
        setCouponNos(Array.from(new Set(all)));
      })
      .catch(() => {});
  }, [mallId, selectedEvent, events]);

  // ─── 날짜 축 생성 ─────────────────────────────────────────────
  useEffect(() => {
    const [start, end] = range;
    const arr = [];
    let cur = start.startOf('day');
    const last = end.startOf('day');
    while (cur.isSameOrBefore(last, 'day')) {
      arr.push(cur.format('YYYY-MM-DD'));
      cur = cur.add(1, 'day');
    }
    setDates(arr);
  }, [range]);

  // ─── 상품 클릭 퍼포먼스 조회 ─────────────────────────────────
  useEffect(() => {
    if (!mallId || !selectedEvent) return;
    api.get(`/api/${mallId}/analytics/${selectedEvent}/product-performance`)
      .then(res => setProdPerf(res.data || []))
      .catch(() => {});
  }, [mallId, selectedEvent]);

  // ─── 데이터 조회 함수 (통합) ─────────────────────────────────
  const fetchData = () => {
    if (!mallId || !selectedEvent || !selectedUrl) return;
    setLoading(true);

    const [s, e] = range.map(d => d.format('YYYY-MM-DD'));
    const params = {
      start_date: `${s}T00:00:00+09:00`,
      end_date:   `${e}T23:59:59.999+09:00`,
      url:        selectedUrl
    };

    const visReq   = api.get(`/api/${mallId}/analytics/${selectedEvent}/visitors-by-date`, { params });
    const clickReq = api.get(`/api/${mallId}/analytics/${selectedEvent}/clicks-by-date`,     { params });
    const devReq   = api.get(`/api/${mallId}/analytics/${selectedEvent}/devices-by-date`,    { params });
    const couponReq = couponNos.length
      ? api.get(`/api/${mallId}/analytics/${selectedEvent}/coupon-stats`, {
          params: {
            coupon_no:  couponNos.join(','),
            start_date: s,
            end_date:   e
          }
        })
      : Promise.resolve({ data: [] });

    Promise.all([visReq, clickReq, devReq, couponReq])
      .then(([visRes, clkRes, devRes, cpnRes]) => {
        // 방문자
        const vis = Array.isArray(visRes.data) ? visRes.data : [];
        const newMap = new Map(vis.map(o => [o.date, o.newVisitors   || 0]));
        const retMap = new Map(vis.map(o => [o.date, o.returningVisitors || 0]));
        setNewByDate(dates.map(d => newMap.get(d) || 0));
        setRetByDate(dates.map(d => retMap.get(d) || 0));

        // 디바이스
        const dev = Array.isArray(devRes.data) ? devRes.data : [];
        const pcMap = new Map(), andMap = new Map(), iosMap = new Map();
        dev.forEach(o => {
          if (o.device === 'PC')          pcMap.set(o.date, o.count);
          else if (o.device === 'Android') andMap.set(o.date, o.count);
          else if (o.device === 'iOS')      iosMap.set(o.date, o.count);
        });
        setPcByDate(  dates.map(d => pcMap.get(d)  || 0));
        setAndByDate(dates.map(d => andMap.get(d) || 0));
        setIosByDate(dates.map(d => iosMap.get(d) || 0));

        // 쿠폰 통계
        const cstats = Array.isArray(cpnRes.data) ? cpnRes.data : [];
        setCouponStats(cstats);
        const tot = cstats.reduce((acc, cur) => {
          acc.issued += cur.issuedCount      || 0;
          acc.used   += cur.usedCount        || 0;
          acc.unused += cur.unusedCount      || 0;
          acc.autoDel+= cur.autoDeletedCount || 0;
          return acc;
        }, { issued: 0, used: 0, unused: 0, autoDel: 0 });
        setCouponTotals(tot);
      })
      //.catch(() => message.error('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchData, [selectedUrl, range, couponNos]);

  // ─── 차트 옵션 ────────────────────────────────────────────────
  const visitorLineOpt = {
    title:   { text: '신규 vs 재방문', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend:  { data: ['신규','재방문'], top: 30 },
    xAxis:   { type: 'category', data: dates },
    yAxis:   { type: 'value' },
    series: [
      { name: '신규',   type: 'line', data: newByDate },
      { name: '재방문', type: 'line', data: retByDate }
    ]
  };

  const deviceLineOpt = {
    title:   { text: '디바이스별 유입', left: 'center' },
    tooltip: { trigger: 'axis' },
    legend:  { data: ['PC','Android','iOS'], top: 30 },
    xAxis:   { type: 'category', data: dates },
    yAxis:   { type: 'value' },
    series: [
      { name: 'PC',      type: 'line', data: pcByDate },
      { name: 'Android', type: 'line', data: andByDate },
      { name: 'iOS',     type: 'line', data: iosByDate }
    ]
  };

  const top5Opt = {
    title:  { text: '상품 클릭 Top 5', left: 'center', top: 10 },
    tooltip:{ trigger: 'axis' },
    grid:   { left: 60, right: 20, bottom: 60 },
    xAxis:  {
      type: 'category',
      data: prodPerf.slice(0,5).map(o => o.productName),
      axisLabel: { rotate: 30 }
    },
    yAxis: { type: 'value' },
    series:[{
      name: '클릭수',
      type: 'bar',
      data: prodPerf.slice(0,5).map(o => o.clicks),
      // ↓ 각 막대마다 색을 다르게
      itemStyle: {
        color: ({ dataIndex }) => {
          const colors = ['#fe6326', '#91CC75', '#FAC858', '#EE6666', '#73C0DE'];
          return colors[dataIndex % colors.length];
        }
      }
    }]
  };

  // ─── 이벤트 페이지 이동 기능 추가 ───────────────────────────────
  // 기본 도메인 (요구하신 대로 하드코딩). 필요한 경우 환경변수로 변경하세요.
  const SITE_BASE = 'https://yogibo.kr';

  const openEventPage = () => {
    // 선택된 URL 우선, 없으면 urls[0] (가장 최근 등록된 것으로 가정), 없으면 fallback 'test.html'
    const urlCandidate = selectedUrl || (urls && urls.length > 0 ? urls[0] : null) || 'test.html';
    let full = urlCandidate;

    // if already absolute URL, open directly
    if (!/^https?:\/\//i.test(urlCandidate)) {
      // ensure it does not produce double slashes
      if (urlCandidate.startsWith('/')) full = `${SITE_BASE}${urlCandidate}`;
      else full = `${SITE_BASE}/${urlCandidate}`;
    }

    try {
      window.open(full, '_blank');
      message.success(`이벤트 페이지로 이동: ${full}`);
    } catch (e) {
      message.error('새 창을 열 수 없습니다.');
    }
  };

  // ─── 렌더링 ───────────────────────────────────────────────────
  return (
    <Space direction="vertical" style={{ width: '100%', padding: 24, gap: 24 }} className="dashbord">
      {/* 컨트롤 + KPI 섹션 */}
      <Card>
        <Row gutter={16} align="middle">
          <Col>
            <Select
              placeholder="이벤트 선택"
              options={events.map(e => ({ label: e.title||'(제목없음)', value: e._id }))}
              value={selectedEvent}
              onChange={setSelectedEvent}
              style={{ width: 200 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="페이지 선택"
              options={urls.map(u => ({ label: u, value: u }))}
              value={selectedUrl}
              onChange={setSelectedUrl}
              style={{ width: 240 }}
            />
          </Col>
          <Col>
            <RangePicker
              value={range}
              format="YYYY-MM-DD"
              onChange={vals => vals && setRange(vals)}
              disabledDate={d => minDate && d.isBefore(minDate,'day')}
            />
          </Col>
          <Col><Button type="primary" onClick={fetchData}>조회</Button></Col>

          {/* 이 버튼은 이제 선택된(또는 가장 최근) URL로 새 탭을 엽니다 */}
          <Col><Button type="primary" onClick={openEventPage}>이벤트 페이지 이동</Button></Col>

          <Col flex="auto" />
          <Col className="kpi-col"><Statistic title="전체 이벤트 수" value={eventCount} suffix="개" valueStyle={{ fontSize: 18 }}  style={{textAlign:'center'}}/></Col>
          <Col  className="kpi-col" ><Statistic title="전체 쿠폰 수" value={couponCount} suffix="개" style={{ marginLeft: 16,textAlign:'center' }}  valueStyle={{ fontSize: 18 }}/></Col>
        </Row>
      </Card>

      {/* 1행: 신규 vs 재방문 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card bodyStyle={{ height: 320 }}>
            <ReactECharts option={visitorLineOpt} style={{ height: '100%' }} />
          </Card>
        </Col>

        {/* 2열: 쿠폰 다운로드/주문 완료 통계 */}
        <Col xs={24} md={12}>
          <Card
            title="쿠폰 다운로드 / 주문 완료 통계"
            style={{
              height: 320,
              overflowY: 'auto',
              textAlign: 'center'
            }}
            bodyStyle={{ padding: 16, height: '100%' }}
            loading={loading}
          >
            <Space size="large" style={{ marginBottom: 16, justifyContent: 'center' }} className="couponTxtList">
              <Statistic title="발급 쿠폰"   value={couponTotals.issued}  suffix="개" valueStyle={{ fontSize: 18 }} />
              <Statistic title="사용 쿠폰"   value={couponTotals.used}    suffix="개" valueStyle={{ fontSize: 18 }} />
              <Statistic title="미사용 쿠폰" value={couponTotals.unused}  suffix="개" valueStyle={{ fontSize: 18 }} />
            </Space>
            <Table
              size="small"
              columns={[
                { title: '쿠폰명',     dataIndex: 'couponName',    key: 'couponName' },
                { title: '다운로드 수',  dataIndex: 'issuedCount', key: 'issuedCount', align: 'right' },
                { title: '주문 완료 수', dataIndex: 'usedCount',   key: 'usedCount',   align: 'right' }
              ]}
              dataSource={couponStats}
              rowKey="couponName"
              pagination={false}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 3행: 디바이스 + 상품 클릭 Top5 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card bodyStyle={{ height: 320 }}>
            <ReactECharts option={deviceLineOpt} style={{ height: '100%' }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card bodyStyle={{ height: 320 }}>
            <ReactECharts option={top5Opt} style={{ height: '100%' }} />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
