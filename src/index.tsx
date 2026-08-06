import { render } from 'react-dom';
import React, { FunctionComponent } from 'react';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { en, ja } from 'make-plural/plurals';
import { messages as jaMessages } from './locales/ja/messages';
import { messages as enMessages } from './locales/en/messages';
import './index.css';
import { Map } from './map';

// Load plural rules per locale (avoids Lingui's "plurals not loaded" fallback warning).
i18n.loadLocaleData({
  ja: { plurals: ja },
  en: { plurals: en },
});

i18n.load({ ja: jaMessages, en: enMessages });
i18n.activate('ja');

const App: FunctionComponent = () => (
  <I18nProvider i18n={i18n} forceRenderOnLocaleChange={false}>
    <Map />
  </I18nProvider>
);
render(<App />, document.getElementById('root'));
