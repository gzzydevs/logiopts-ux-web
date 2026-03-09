Name:           logitux
Version:        1.0.0
Release:        1%{?dist}
Summary:        Logitech device configuration for Linux
License:        MIT
URL:            https://github.com/gzzydevs/logiopts-ux-web
Source0:        %{name}-%{version}.tar.gz

Requires:       nodejs >= 18
Recommends:     solaar
BuildArch:      noarch

# No compilation needed — tarball is pre-built
%global debug_package %{nil}

%description
Local web app for configuring Logitech devices on Linux.
Starts an Express server on localhost:3001 and opens the browser.

%prep
%setup -q

%install
mkdir -p %{buildroot}/opt/%{name}/{bin,dist,dist-server,node_modules}
mkdir -p %{buildroot}/%{_bindir}
mkdir -p %{buildroot}/%{_datadir}/applications
mkdir -p %{buildroot}/%{_datadir}/icons/hicolor/256x256/apps

# Copy artifacts
cp -r dist/* %{buildroot}/opt/%{name}/dist/
cp -r dist-server/* %{buildroot}/opt/%{name}/dist-server/
cp -r node_modules/* %{buildroot}/opt/%{name}/node_modules/
cp package.json %{buildroot}/opt/%{name}/
install -m 755 bin/logitux %{buildroot}/opt/%{name}/bin/logitux

# Symlink in PATH
ln -sf /opt/%{name}/bin/logitux %{buildroot}/%{_bindir}/logitux

# Desktop entry
install -m 644 logitux.desktop %{buildroot}/%{_datadir}/applications/logitux.desktop

# Icon (if present)
[ -f logitux.png ] && install -m 644 logitux.png %{buildroot}/%{_datadir}/icons/hicolor/256x256/apps/logitux.png || true

%files
/opt/%{name}/
%{_bindir}/logitux
%{_datadir}/applications/logitux.desktop

%changelog
* Sun Mar 08 2026 LogiTux Maintainer <maintainer@logitux.dev> - 1.0.0-1
- Initial release
