import { ReactElement } from 'react';
import BannerDateTime from '../BannerDateTime';
import BannerLinks from '../BannerLinks';
import BannerLogo from '../BannerLogo';

/**
 * Banner Component
 *
 * This component returns a banner that includes a logo, current date/time, and some links.
 * @returns {ReactElement} - the banner component.
 */
const Banner = (): ReactElement => {
  return (
    <div className="flex w-full flex-row justify-between items-center">
      <BannerLogo />

      {/* AI Video Container - positioned between logo and time */}
      <div
        id="ai-video-container"
        className="flex-1 mx-4"
        style={{
          height: '72px',
          backgroundColor: 'transparent',
          borderRadius: '8px',
          overflow: 'hidden',
          minWidth: '128px',
          maxWidth: '200px',
        }}
      />

      <div className="flex px-4">
        <BannerDateTime />
        <BannerLinks />
      </div>
    </div>
  );
};

export default Banner;
