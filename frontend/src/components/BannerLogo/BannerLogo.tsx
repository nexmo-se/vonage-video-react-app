import { ReactElement } from 'react';
import { Link } from 'react-router-dom';

/**
 * BannerLogo Component
 *
 * This component returns the logo that redirects to the landing page when clicked.
 * @returns {ReactElement} - the banner logo component
 */
const BannerLogo = (): ReactElement => (
  <Link to="..">
    <div className="box-border" data-testid="banner-logo">
      <img
        className="hidden h-[72px] pl-4 pr-8 md:flex"
        src="/images/promony.png"
        alt="Promony-desktop-logo"
      />
      <img
        className="my-4 h-10 px-8 md:hidden"
        src="/images/promony.png"
        alt="Promony-mobile-logo"
      />
    </div>
  </Link>
);

export default BannerLogo;
