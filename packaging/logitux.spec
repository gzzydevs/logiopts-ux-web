Name:           logitux
Version:        1.0.0
Release:        1%{?dist}
Summary:        Logitech device configuration for Linux
License:        MIT
URL:            https://github.com/gzzydevs/logiopts-ux-web
Source0:        %{name}-%{version}.tar.gz

Requires:       solaar
ExclusiveArch:  x86_64

# gtk-update-icon-cache and udevadm are needed in post-install hooks
Requires(post):   systemd
Requires(postun): systemd

# No compilation needed — tarball is pre-built with bundled Node.js
%global debug_package %{nil}

%description
Local web app for configuring Logitech devices on Linux.
Bundles Node.js runtime — no external dependencies besides solaar.
Starts an Express server on localhost:3001 and opens the browser.

%prep
%setup -q

%install
mkdir -p %{buildroot}/opt/%{name}/{bin,dist,dist-server,node_modules}
mkdir -p %{buildroot}/%{_bindir}
mkdir -p %{buildroot}/%{_datadir}/applications
mkdir -p %{buildroot}/%{_datadir}/icons/hicolor/256x256/apps
mkdir -p %{buildroot}%{_prefix}/lib/udev/rules.d

# Copy artifacts (includes bundled Node binary at bin/node)
cp -r dist/* %{buildroot}/opt/%{name}/dist/
cp -r dist-server/* %{buildroot}/opt/%{name}/dist-server/
cp -r node_modules/* %{buildroot}/opt/%{name}/node_modules/
cp package.json %{buildroot}/opt/%{name}/
install -m 755 bin/node %{buildroot}/opt/%{name}/bin/node
install -m 755 bin/logitux %{buildroot}/opt/%{name}/bin/logitux

# Symlink in PATH
ln -sf /opt/%{name}/bin/logitux %{buildroot}/%{_bindir}/logitux

# Desktop entry
install -m 644 logitux.desktop %{buildroot}/%{_datadir}/applications/logitux.desktop

# Icon (if present)
[ -f logitux.png ] && install -m 644 logitux.png %{buildroot}/%{_datadir}/icons/hicolor/256x256/apps/logitux.png || true

# udev rules for Logitech HID++ devices
[ -f 99-logitux.rules ] && install -m 644 99-logitux.rules %{buildroot}%{_prefix}/lib/udev/rules.d/99-logitux.rules || true

%post
/usr/bin/udevadm control --reload-rules 2>/dev/null || :
/usr/bin/udevadm trigger --subsystem-match=hidraw 2>/dev/null || :
if [ -x /usr/bin/gtk-update-icon-cache ]; then
  /usr/bin/gtk-update-icon-cache -f -t %{_datadir}/icons/hicolor 2>/dev/null || :
fi

%postun
/usr/bin/udevadm control --reload-rules 2>/dev/null || :
if [ -x /usr/bin/gtk-update-icon-cache ]; then
  /usr/bin/gtk-update-icon-cache -f -t %{_datadir}/icons/hicolor 2>/dev/null || :
fi

%files
/opt/%{name}/
%{_bindir}/logitux
%{_datadir}/applications/logitux.desktop
%{_prefix}/lib/udev/rules.d/99-logitux.rules

%changelog
* Sun Mar 09 2026 gzzy.dev <gzzy.dev@gmail.com> - 1.0.0-2
- Bundle Node.js 24 portable (amd64 only), remove nodejs dependency

* Sun Mar 08 2026 gzzy.dev <gzzy.dev@gmail.com> - 1.0.0-1
- Initial release
