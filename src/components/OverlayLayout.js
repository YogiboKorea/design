// src/components/OverlayLayout.jsx
import React from 'react';
import { Layout } from 'antd';

export default function OverlayLayout({ children }) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Content style={{ padding: 0 }}>
        {children}
      </Layout.Content>
    </Layout>
  );
}
